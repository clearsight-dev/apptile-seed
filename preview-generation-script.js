const {spawn} = require('child_process');
const {createReadStream, createWriteStream} = require('fs');
const {writeFile, mkdir, readdir, readFile, stat} = require('node:fs/promises');
const path = require('path');
const archiver = require('archiver');
const axios = require('axios');

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

const metroCodegenPlugins = async (remoteCode = '', pluginNames = []) => {
  console.log(
    '[metroCodegenPlugins] Generating plugins:',
    remoteCode,
    pluginNames,
  );
  try {
    let contents = `export function initPlugins() {
return [
`;
    for (let name of pluginNames) {
      let entry = 'source/widget';
      const camelCasePackageName = toCamelCase(name);
      contents =
        `import ${camelCasePackageName} from "./plugins/${name}/${entry}";\n` +
        contents;
      contents += `    ${camelCasePackageName},\n`;
    }
    contents =
      '// This file is generated. Do not edit.\n' + contents + '  ];\n}';
    const iosRemoteEntryPath = path.resolve(remoteCode, 'index.js');
    await writeFile(iosRemoteEntryPath, contents);
    console.log('[metroCodegenPlugins] Wrote plugins to:', iosRemoteEntryPath);
  } catch (error) {
    console.error('[metroCodegenPlugins] Error:', error);
    throw error;
  }
};

const metroCodegenNavs = async (remoteCode = '', navNames = []) => {
  console.log(
    '[metroCodegenNavs] Generating navigators:',
    remoteCode,
    navNames,
  );
  try {
    let contents = `import {registerCreator} from 'apptile-core';
export const navs = [
`;
    for (let name of navNames) {
      const camelCasePackageName = toCamelCase(name);
      contents =
        `import ${camelCasePackageName} from "./navigators/${name}/source";\n` +
        contents;
      contents += `  {creator: ${camelCasePackageName}, name: "${name}" },\n`;
    }
    contents += `];\n
export function initNavs() {
  for (let nav of navs) {
    registerCreator(nav.name, nav.creator);
  }
}
  `;
    contents = `// This file is generated. Do not edit.\n` + contents;
    const iosRemoteNavEntry = path.resolve(remoteCode, 'indexNav.js');
    await writeFile(iosRemoteNavEntry, contents);
    console.log('[metroCodegenNavs] Wrote navigators to:', iosRemoteNavEntry);
  } catch (error) {
    console.error('[metroCodegenNavs] Error:', error);
    throw error;
  }
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

const generateIosBundle = async () => {
  console.log('[generateIosBundle] Generating iOS bundle');
  try {
    const remoteCode = path.resolve('remoteCode');
    const pluginsDir = path.resolve(remoteCode, 'plugins');
    await ensurePlugins(pluginsDir);
    const pluginEntries = await readdir(pluginsDir, {withFileTypes: true});
    const plugins = pluginEntries
      .filter(it => it.isDirectory())
      .map(it => it.name);
    const navDir = path.resolve(remoteCode, 'navigators');
    await ensurePlugins(navDir);
    const navEntries = await readdir(navDir, {withFileTypes: true});
    const navs = navEntries.filter(it => it.isDirectory()).map(it => it.name);

    await metroCodegenPlugins(remoteCode, plugins);
    await metroCodegenNavs(remoteCode, navs);

    const extraModulesPath = path.resolve('extra_modules.json');

    try {
      await stat(extraModulesPath);
    } catch (error) {
      console.log(
        '[generateIosBundle] extra_modules.json not found, running iosProjectSetup.js',
      );
      const iosProjectSetupPath = path.resolve(appRoot, 'iosProjectSetup.js');
      try {
        await executeCommand('node', [iosProjectSetupPath], {
          cwd: path.resolve(appRoot),
        });
        console.log('[generateIosBundle] Successfully ran iosProjectSetup.js');
      } catch (err) {
        console.error(
          '[generateIosBundle] Error running iosProjectSetup.js:',
          err,
        );
        throw err;
      }
    }

    try {
      const bundleArgs = [
        'bundle',
        '--entry-file',
        './index.js',
        '--platform',
        'ios',
        '--dev',
        'false',
        '--minify',
        'true',
        '--bundle-output',
        './ios/main.jsbundle',
        '--assets-dest',
        './ios/bundleassets',
      ];

      console.log('[generateIosBundle] Starting React Native bundle command');
      await executeCommand('node_modules/.bin/react-native', bundleArgs, {
        cwd: path.resolve(appRoot),
      });
      console.log('[generateIosBundle] Successfully bundled iOS app');
    } catch (err) {
      console.error('[generateIosBundle] Error bundling iOS app:', err);
      throw err;
    }

    const timestamp = Date.now();
    const generatedPath = path.resolve(
      remoteCode,
      `generated/bundles/ios/${timestamp}`,
    );
    await mkdir(generatedPath, {recursive: true});

    return await new Promise((resolve, reject) => {
      const bundleDestination = path.resolve(generatedPath, 'bundle.zip');
      const writeStream = createWriteStream(bundleDestination);
      writeStream.on('close', () => {
        resolve({bundleDestination});
      });
      writeStream.on('error', err => {
        console.error('[generateIosBundle] Error writing bundle zip:', err);
        reject(err);
      });
      const archive = archiver('zip', {zlib: {level: 9}});
      archive.on('warning', wrn => {
        console.warn('[generateIosBundle] archiver warning: ', wrn);
      });

      archive.on('error', err => {
        if (err) {
          console.error('[generateIosBundle] Failure in archiver ', err);
        }
        reject(err);
      });
      archive.pipe(writeStream);

      archive.file(path.resolve(appRoot, 'ios/main.jsbundle'), {
        name: 'main.jsbundle',
      });
      archive.directory(path.resolve(appRoot, 'ios/bundleassets'), false);
      archive.finalize();
    });
  } catch (error) {
    console.error('[generateIosBundle] Error:', error);
    throw error;
  }
};

const generateAndroidBundle = async () => {
  console.log('[generateAndroidBundle] Generating Android bundle');
  try {
    const remoteCode = path.resolve('remoteCode');
    const pluginsDir = path.resolve(remoteCode, 'plugins');
    const pluginEntries = await readdir(pluginsDir, {withFileTypes: true});
    const plugins = pluginEntries
      .filter(it => it.isDirectory())
      .map(it => it.name);
    const navDir = path.resolve(remoteCode, 'navigators');
    const navEntries = await readdir(navDir, {withFileTypes: true});
    const navs = navEntries.filter(it => it.isDirectory()).map(it => it.name);

    await metroCodegenPlugins(remoteCode, plugins);
    await metroCodegenNavs(remoteCode, navs);

    const extraModulesPath = path.resolve('extra_modules.json');

    try {
      await stat(extraModulesPath);
    } catch (error) {
      console.log(
        '[generateAndroidBundle] extra_modules.json not found, running androidProjectSetup.js',
      );
      const androidProjectSetupPath = path.resolve(
        appRoot,
        'androidProjectSetup.js',
      );
      try {
        await executeCommand('node', [androidProjectSetupPath], {
          cwd: path.resolve(appRoot),
        });
        console.log(
          '[generateAndroidBundle] Successfully ran androidProjectSetup.js',
        );
      } catch (err) {
        console.error(
          '[generateAndroidBundle] Error running androidProjectSetup.js:',
          err,
        );
        throw err;
      }
    }

    try {
      const bundleArgs = [
        'bundle',
        '--entry-file',
        './index.js',
        '--platform',
        'android',
        '--dev',
        'false',
        '--minify',
        'true',
        '--bundle-output',
        './android/app/src/main/assets/index.android.bundle',
        '--assets-dest',
        './android/app/src/main/assets/assets',
      ];

      console.log(
        '[generateAndroidBundle] Starting React Native bundle command',
      );
      await executeCommand('node_modules/.bin/react-native', bundleArgs, {
        cwd: path.resolve(appRoot),
      });
      console.log('[generateAndroidBundle] Successfully bundled Android app');
    } catch (err) {
      console.error('[generateAndroidBundle] Error bundling Android app:', err);
      throw err;
    }

    const timestamp = Date.now();
    const generatedPath = path.resolve(
      remoteCode,
      `generated/bundles/android/${timestamp}`,
    );
    await mkdir(generatedPath, {recursive: true});

    return await new Promise((resolve, reject) => {
      const bundleDestination = path.resolve(generatedPath, 'bundle.zip');
      const writeStream = createWriteStream(bundleDestination);
      writeStream.on('close', () => {
        resolve({bundleDestination});
      });
      writeStream.on('error', err => {
        console.error('[generateAndroidBundle] Error writing bundle zip:', err);
        reject(err);
      });
      const archive = archiver('zip', {zlib: {level: 9}});
      archive.on('warning', wrn => {
        console.warn('[generateAndroidBundle] archiver warning: ', wrn);
      });

      archive.on('error', err => {
        if (err) {
          console.error('[generateAndroidBundle] Failure in archiver ', err);
        }
        reject(err);
      });
      archive.pipe(writeStream);

      archive.file(
        path.resolve(
          appRoot,
          'android/app/src/main/assets/index.android.bundle',
        ),
        {name: 'index.android.bundle'},
      );
      archive.directory(
        path.resolve(appRoot, 'android/app/src/main/assets/assets'),
        false,
      );
      archive.finalize();
    });
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
      `${getBackendUrl(isStaging)}/api/apps/${appId}/upload`,
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
    const config = JSON.parse(
      await readFile(path.join(appRoot, 'apptile.config.json'), 'utf-8'),
    );

    config.SDK_PATH = path.resolve(appRoot, '../ReactNativeTSProjeect');
    config.APP_ID = appId;

    await writeFile(
      path.join(appRoot, 'apptile.config.json'),
      JSON.stringify(config, null, 2),
    );

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
        )}/api/apps/${appId}/fork/${forkId}/branch/${branchName}/PreviewAppDraft`,
        {
          androidBundleUrlStatus: 'done',
          iosBundleUrlStatus: 'done',
          iosBundleUrl: iosResult.data.cdnlink,
          androidBundleUrl: androidResult.data.cdnlink,
          publishedCommitId,
        },
        makeHeaders({}),
      );

      console.log('[main] Draft creation response:', draftResult);

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
