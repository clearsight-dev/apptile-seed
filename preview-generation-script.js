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

let SDK_SHA = '';
let GIT_SHA = '';

console.log(
  'Received arguments:',
  appId,
  forkId,
  branchName,
  publishedCommitId,
  isStaging,
);

const appRoot = __dirname;

const toCamelCase = kebabCaseName => {
  console.log(
    '[toCamelCase] Converting kebab case to camel case:',
    kebabCaseName,
  );
  const words = kebabCaseName.split('-');
  for (let i = 1; i < words.length; ++i) {
    words[i] = words[i][0].toUpperCase() + words[i].slice(1);
  }
  console.log('[toCamelCase] Converted to camel case:', words.join(''));
  return words.join('');
};

const getBackendUrl = (isStaging = false) => {
  console.log('[getBackendUrl] Getting backend URL:', isStaging);
  return isStaging ? 'https://dev-api.apptile.io' : 'https://api.tile.dev';
};

const ensurePlugins = async path => {
  console.log('[ensurePlugins] Ensuring plugins directory exists:', path);
  try {
    await stat(path);
  } catch (err) {
    console.error('[ensurePlugins] Error checking path:', err);
    if (err?.code === 'ENOENT') {
      await mkdir(path, {recursive: true});
      console.log('[ensurePlugins] Created plugins directory:', path);
    }
  }
};

const generateIosBundle = async (appRoot) => {
  console.log('[generateIosBundle] Generating iOS bundle');
  try {
    const {stdout} = await executeCommand("tile", ["bundle", "--platform", "ios"], {
      cwd: path.resolve(appRoot)
    });
    if (stdout.indexOf("IOS: ") < 0) {
      throw new Error("Could not locate the bundle");
    } else {
      const pathStart = stdout.indexOf("IOS: ");
      const bundleDestination = stdout.substr(pathStart + "IOS: ".length).trim();
      return {bundleDestination};
    }
  } catch(error) {
    console.error('[generateIosBundle] Error:', error);
    throw error
  }
};

const generateAndroidBundle = async () => {
  console.log('[generateAndroidBundle] Generating Android bundle');
  try {
    const {stdout} = await executeCommand("tile", ["bundle", "--platform", "android"], {
      cwd: path.resolve(appRoot)
    });
    if (stdout.indexOf("ANDROID: ") < 0) {
      throw new Error("Could not locate the bundle");
    } else {
      const pathStart = stdout.indexOf("IOS: ");
      const bundleDestination = stdout.substr(pathStart + "ANDROID: ".length).trim();
      return {bundleDestination};
    }
  } catch (error) {
    console.error('[generateAndroidBundle] Error:', error);
    throw error;
  }
};

const getGitShas = async () => {
  if (SDK_SHA && GIT_SHA) {
    return {err: false, gitsha: GIT_SHA, sdksha: SDK_SHA};
  }
  console.log('[getGitShas] Getting Git SHAs');
  try {
    let sdksha = '';
    try {
      console.log('[getGitShas] Getting SDK Git SHA');
      const sdkResult = await executeCommand(
        'git',
        ['log', '-n', '1', '--format=format:%H'],
        {
          cwd: path.resolve(appRoot, '../ReactNativeTSProjeect'),
        },
      );
      sdksha = sdkResult.stdout.trim() || '';
      console.log('[getGitShas] SDK Git SHA:', sdksha);
    } catch (err) {
      console.error(
        '[getGitShas] Error getting SDK Git SHA:',
        JSON.stringify(err, null, 2),
      );
      throw err;
    }

    let gitsha = '';
    try {
      console.log('[getGitShas] Getting app Git SHA');
      const appResult = await executeCommand(
        'git',
        ['log', '-n', '1', '--format=format:%H'],
        {
          cwd: path.resolve('remoteCode'),
        },
      );
      gitsha = appResult.stdout.trim() || '';
      console.log('[getGitShas] App Git SHA:', gitsha);
    } catch (err) {
      console.error(
        '[getGitShas] Error getting app Git SHA:',
        JSON.stringify(err, null, 2),
      );
      throw err;
    }

    SDK_SHA = sdksha;
    GIT_SHA = gitsha;
    return {err: false, gitsha, sdksha};
  } catch (err) {
    console.error(
      '[getGitShas] Error getting Git SHAs:',
      JSON.stringify(err, null, 2),
    );
    return {err};
  }
};

const getMobileBundle = async (bundleName, os) => {
  console.log('[getMobileBundle] Getting mobile bundle:', bundleName, os);
  try {
    const assetZip = path.resolve(
      `remoteCode/generated/bundles/${os}`,
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

    // const {err, gitsha, sdksha} = await getGitShas();
    // if (err) {
    //   console.error('[uploadMobileBundle] Failed to retrieve git shas');
    //   throw new Error(`Failed to retrieve git shas: ${err.message}`);
    // }

    const formData = new FormData();
    formData.append('assetZipFile', createReadStream(assetZip));
    formData.append(
      'uploadDestination',
      os === 'ios' ? 'ios-jsbundle' : 'android-jsbundle',
    );
    formData.append('gitsha', 'f6d73bccad27015c7fc84b166557b85cb792878b'); // gitsha);
    formData.append('sdksha', 'f6d73bccad27015c7fc84b166557b85cb792878b'); // sdksha);
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
) => {
  console.log('[main] Starting main function');
  try {
    // const config = JSON.parse(
    //   await readFile(path.join(appRoot, 'apptile.config.json'), 'utf-8'),
    // );

    // config.SDK_PATH = path.resolve(appRoot, '../ReactNativeTSProjeect');
    // config.APP_ID = appId;

    // await writeFile(
    //   path.join(appRoot, 'apptile.config.json'),
    //   JSON.stringify(config, null, 2),
    // );

    // const [iosBundle, androidBundle] = await Promise.all([
    //   generateIosBundle(appRoot),
    //   generateAndroidBundle(appRoot),
    // ]);

    const iosBundle = await generateIosBundle(appRoot);
    const iosTimestamp = iosBundle.bundleDestination.split('/').at(-2);

    const androidBundle = await generateAndroidBundle(appRoot);
    const androidTimestamp = androidBundle.bundleDestination.split('/').at(-2);

    console.log('[main] Uploading iOS bundle:', iosTimestamp);
    console.log('[main] Uploading Android bundle:', androidTimestamp);

    // const [iosResult, androidResult] = await Promise.all([
    //   uploadMobileBundle(iosTimestamp, 'ios'),
    //   uploadMobileBundle(androidTimestamp, 'android'),
    // ]);
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
main(appId, forkId, branchName, publishedCommitId, isStaging)
  .then(() => {
    console.log('[main] Preview generation finished successfully!');
  })
  .catch(error => {
    console.error('[main] Preview generation failed!', error);
  })
  .finally(() => {
    console.timeEnd('Preview Generation');
  });
