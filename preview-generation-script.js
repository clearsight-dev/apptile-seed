const {spawn} = require('child_process');
const {createReadStream, createWriteStream} = require('fs');
const {writeFile, mkdir, readdir, readFile, stat} = require('node:fs/promises');
const path = require('path');
const archiver = require('archiver');
const axios = require('axios');
const FormData = require('form-data');

// Helper function to execute commands with streaming output
const executeCommand = (command, args = [], options = {}) => {
  return new Promise((resolve, reject) => {
    console.log(`[executeCommand] Executing: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      stdio: 'pipe',
      ...options,
    });

    let stdout = '';
    let stderr = '';

    // Stream stdout in real-time with timestamps
    child.stdout.on('data', data => {
      const output = data.toString();
      const lines = output.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`[${new Date().toISOString()}] STDOUT: ${line}`);
        }
      });
      stdout += output;
    });

    // Stream stderr in real-time with timestamps
    child.stderr.on('data', data => {
      const output = data.toString();
      const lines = output.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.error(`[${new Date().toISOString()}] STDERR: ${line}`);
        }
      });
      stderr += output;
    });

    child.on('close', code => {
      console.log(`[executeCommand] Command finished with exit code: ${code}`);
      if (code === 0) {
        resolve({stdout, stderr, code});
      } else {
        const error = new Error(`Command failed with exit code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        reject(error);
      }
    });

    child.on('error', error => {
      console.error(`[executeCommand] Command error:`, error);
      reject(error);
    });
  });
};

const previewConfigString = process.env.PREVIEW_CONFIG;
if (!previewConfigString || previewConfigString.trim() === '') {
  throw new Error('NO PREVIEW CONFIG PASSED IN ENV');
}

const previewConfig = JSON.parse(decodeURIComponent(previewConfigString));
console.log('Preview config:', previewConfig);

const appId = previewConfig.appId;
const forkId = previewConfig.forkId;
const branchName = previewConfig.branchName;
const publishedCommitId = previewConfig.publishedCommitId;
const isStaging = previewConfig.isStaging;
const message = previewConfig.message || 'no message';

console.log(
  'Received arguments:',
  appId,
  forkId,
  branchName,
  publishedCommitId,
  isStaging,
);

const appRoot = __dirname;

const getBackendUrl = (isStaging = false) => {
  console.log('[getBackendUrl] Getting backend URL:', isStaging);
  return isStaging ? 'https://dev-api.apptile.io' : 'https://api.tile.dev';
};

const generateBundle = async (appRoot, message, platform) => {
  console.log(`[generateBundle] Generating ${platform} bundle`);
  try {
    const {stdout} = await executeCommand(
      'tile',
      ['bundle', '--platform', platform, '--message', JSON.stringify(message)],
      {
        cwd: path.resolve(appRoot),
      },
    );
    const tag = platform.toUpperCase() + ': ';
    if (stdout.indexOf(tag) < 0) {
      throw new Error('Could not locate the bundle');
    } else {
      const pathStart = stdout.indexOf(tag);
      const bundleDestination = stdout.substr(pathStart + tag.length).trim();
      return {bundleDestination};
    }
  } catch (error) {
    console.error('[generateBundle] Error:', error);
    throw error;
  }
};

const getMobileBundle = async (bundleName, os) => {
  console.log('[getMobileBundle] Getting mobile bundle:', bundleName, os);
  try {
    const assetZip = path.resolve(
      `src/generated/bundles/${os}`,
      bundleName,
      'bundle.zip',
    );
    await stat(assetZip);
    console.log('[getMobileBundle] Found bundle:', assetZip);
    return {err: false, assetZip};
  } catch (err) {
    console.error(`[getMobileBundle] Bundle not found for ${os}:`, err);
    return {err};
  }
};

const makeHeaders = (extraHeaders = {}) => {
  console.log('[makeHeaders] Making headers:', extraHeaders);
  const header = {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    Connection: 'keep-alive',
    'If-None-Match': 'W/"5b1-kyqqkRyAnA0NO0WgKmBhdQQi7Qo"',
    Origin: 'https://app.apptile.io',
    Referer: 'https://app.apptile.io',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'sec-ch-ua':
      '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    Authorization: isStaging
      ? process.env.ELEVATED_PREVIEW_TOKEN_STAGING
      : process.env.ELEVATED_PREVIEW_TOKEN_PRODUCTION,
    fromCodeBuild: true,
    ...extraHeaders,
  };
  console.log('[makeHeaders] Made headers:', header);
  return {
    headers: header,
  };
};

const uploadMobileBundle = async (bundleName, os) => {
  console.log('[uploadMobileBundle] Uploading mobile bundle:', bundleName, os);
  try {
    const {err: bundleErr, assetZip} = await getMobileBundle(bundleName, os);
    if (bundleErr || !assetZip) {
      console.error('[uploadMobileBundle] Bundle error or asset zip not found');
      throw new Error(
        `Failed to retrieve bundle: ${bundleErr || 'Asset zip not found'}`,
      );
    }

    const {err, gitsha, sdksha} = await getGitShas();
    if (err) {
      console.error('[uploadMobileBundle] Failed to retrieve git shas');
      throw new Error(`Failed to retrieve git shas: ${err.message}`);
    }

    const formData = new FormData();
    formData.append('assetZipFile', createReadStream(assetZip));
    formData.append(
      'uploadDestination',
      os === 'ios' ? 'ios-jsbundle' : 'android-jsbundle',
    );
    formData.append('gitsha', gitsha);
    formData.append('sdksha', sdksha);
    formData.append('tag', 'sometag');

    const headers = makeHeaders(formData.getHeaders?.() || {});

    const response = await axios.post(
      `${getBackendUrl(isStaging)}/api/v2/app/${appId}/upload`,
      formData,
      headers,
    );

    console.log('[uploadMobileBundle] Upload response:', response);

    if (response.status >= 400) {
      try {
        const errorMessage = response.data;
        console.error('[uploadMobileBundle] Failed to upload:', errorMessage);
        throw new Error(`Failed to upload: ${errorMessage}`);
      } catch (err) {
        console.error(
          '[uploadMobileBundle] Unprocessable error during upload:',
          err,
        );
        throw err;
      }
    }

    console.log('[uploadMobileBundle] Upload successful:', response.data);

    return {
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.error(
      '[uploadMobileBundle] Error:',
      JSON.stringify(error, null, 2),
    );
    throw error;
  }
};

const main = async (
  appId,
  forkId,
  branchName,
  publishedCommitId,
  isStaging,
  message,
) => {
  console.log('[main] Starting main function');
  try {
    const config = JSON.parse(
      await readFile(path.join(appRoot, 'apptile.config.json'), 'utf-8'),
    );

    config.SDK_PATH = path.resolve(appRoot, '../ReactNativeTSProjeect');
    config.APP_ID = appId;

    await writeFile(
      path.join(appRoot, 'apptile.config.json'),
      JSON.stringify(config, null, 2),
    );

    // const currentDateString = Intl.DateTimeFormat("en-US", {dateStyle: "full", timeStyle: "medium"}).format(Date.now());
    // await writeFile(
    //   path.join(appRoot, "assets", "buildinfo.json"),
    //   JSON.stringify({
    //     message,
    //     createdAt: currentDateString
    //   }, null, 2)
    // )

    const iosBundle = await generateBundle(appRoot, message, 'ios');
    const iosTimestamp = iosBundle.bundleDestination.split('/').at(-2);

    const androidBundle = await generateBundle(appRoot, message, 'android');
    const androidTimestamp = androidBundle.bundleDestination.split('/').at(-2);

    console.log('[main] Uploading iOS bundle:', iosTimestamp);
    console.log('[main] Uploading Android bundle:', androidTimestamp);

    const iosResult = await uploadMobileBundle(iosTimestamp, 'ios');
    const androidResult = await uploadMobileBundle(androidTimestamp, 'android');

    console.log('[main] iOS upload result:', iosResult);
    console.log('[main] Android upload result:', androidResult);

    try {
      const draftResult = await axios.put(
        `${getBackendUrl(
          isStaging,
        )}/api/v2/app/${appId}/fork/${forkId}/branch/${branchName}/PreviewAppDraft`,
        {
          androidBundleUrlStatus: 'done',
          iosBundleUrlStatus: 'done',
          iosBundleUrl: iosResult.data.cdnlink,
          androidBundleUrl: androidResult.data.cdnlink,
          publishedCommitId,
        },
        makeHeaders({}),
      );

      console.log('[main] Draft creation response:', draftResult.data);

      if (draftResult.status >= 400) {
        try {
          const errorMessage = draftResult.data;
          console.error('[main] Failed to create draft:', errorMessage);
          throw new Error(`Failed to create draft: ${errorMessage}`);
        } catch (err) {
          console.error(
            '[main] Unprocessable error during draft creation:',
            err,
          );
          throw err;
        }
      }
    } catch (error) {
      console.error('[main] Failed to save draft:', error);
    }
  } catch (error) {
    console.error('[main] Error:', error);
  }
};

console.time('Preview Generation');
main(appId, forkId, branchName, publishedCommitId, isStaging, message)
  .then(() => {
    console.log('[main] Preview generation finished successfully!');
  })
  .catch(error => {
    console.error('[main] Preview generation failed!', error);
  })
  .finally(() => {
    console.timeEnd('Preview Generation');
  });
