const {exec} = require('child_process');
const {createReadStream, createWriteStream} = require('fs');
const {writeFile, mkdir, readdir, readFile, stat} = require('node:fs/promises');
const path = require('path');
const archiver = require('archiver');
const axios = require('axios');

const previewConfigString = process.env.PREVIEW_CONFIG;
if (!previewConfigString || previewConfigString.trim() === '') {
  throw new Error('NO PREVIEW CONFIG PASSED IN ENV');
}

const previewConfig = JSON.parse(previewConfigString);
console.log('Preview config:', previewConfig);

const appId = previewConfig.appId;
const forkId = previewConfig.forkId;
const branchName = previewConfig.branchName;
const publishedCommitId = previewConfig.publishedCommitId;
const isStaging = previewConfig.isStaging;

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
      const metadataPath = path.resolve(
        remoteCode,
        `plugins/${name}/metadata.json`,
      );
      try {
        const metadata = await readFile(metadataPath, {encoding: 'utf8'});
        console.log('[metroCodegenPlugins] Reading metadata:', metadataPath);
        const parsedMeta = JSON.parse(metadata);
        entry = parsedMeta.entry;
      } catch (err) {
        console.error(
          '[metroCodegenPlugins] Metadata file not found for plugin ',
          name,
          err,
        );
      }
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

    const command =
      'node_modules/.bin/react-native bundle --entry-file ./index.js --platform ios --dev false --minify true --bundle-output ./ios/main.jsbundle --assets-dest ./ios/bundleassets';
    console.log('[generateIosBundle] Executing command:', command);

    const extraModulesPath = path.resolve(remoteCode, 'extra_modules.json');

    try {
      await stat(extraModulesPath);
    } catch (error) {
      console.log(
        '[generateIosBundle] extra_modules.json not found, running iosProjectSetup.js',
      );
      const iosProjectSetupPath = path.resolve(appRoot, 'iosProjectSetup.js');
      await new Promise((resolve, reject) => {
        exec(
          `node ${iosProjectSetupPath}`,
          {
            cwd: path.resolve(appRoot),
          },
          (err, stdout, stderr) => {
            if (err) {
              console.error(
                '[generateIosBundle] Error running iosProjectSetup.js:',
                err,
              );
              reject(err);
            } else {
              resolve({});
            }
          },
        );
      });
    }

    await new Promise((resolve, reject) => {
      exec(
        command,
        {
          cwd: path.resolve(appRoot),
        },
        (err, stdout, stderr) => {
          if (err) {
            console.error('[generateIosBundle] Error bundling iOS app:', err);
            reject(err);
          } else {
            resolve({});
          }
        },
      );
    });

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

    const command =
      'node_modules/.bin/react-native bundle --entry-file ./index.js --platform android --dev false --minify true --bundle-output ./android/app/src/main/assets/index.android.bundle --assets-dest ./android/app/src/main/assets/assets';
    console.log('[generateAndroidBundle] Executing command:', command);

    const extraModulesPath = path.resolve(remoteCode, 'extra_modules.json');

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
      await new Promise((resolve, reject) => {
        exec(
          `node ${androidProjectSetupPath}`,
          {
            cwd: path.resolve(appRoot),
          },
          (err, stdout, stderr) => {
            if (err) {
              console.error(
                '[generateAndroidBundle] Error running androidProjectSetup.js:',
                err,
              );
              reject(err);
            } else {
              resolve({});
            }
          },
        );
      });
    }

    await new Promise((resolve, reject) => {
      exec(
        command,
        {
          cwd: path.resolve(appRoot),
        },
        (err, stdout, stderr) => {
          if (err) {
            console.error(
              '[generateAndroidBundle] Error bundling Android app:',
              err,
            );
            reject(err);
          } else {
            resolve({});
          }
        },
      );
    });

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
  console.log('[getGitShas] Getting Git SHAs');
  try {
    const {stdout: sdkStdOut, stderr: stderr1} = await exec(
      'git log -n 1 --format=format:%H',
      {cwd: path.resolve('../ReactNativeTSProjeect')},
    );
    if (stderr1) {
      throw new Error(stderr1);
    }
    const sdksha = sdkStdOut.toString().trim();

    const {stdout: appStdOut, stderr} = await exec(
      'git log -n 1 --format=format:%H',
      {cwd: path.resolve('remoteCode')},
    );
    if (stderr) {
      throw new Error(stderr);
    }
    const gitsha = appStdOut.toString().trim();
    console.log('[getGitShas] Got Git SHAs:', sdksha, gitsha);
    return {err: false, gitsha, sdksha};
  } catch (err) {
    console.error('[getGitShas] Error getting Git SHAs:', err);
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
      throw new Error(`Failed to retrieve git shas: ${err}`);
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

    const headers = makeHeaders(formData.getHeaders());

    const response = await axios.post(
      `${getBackendUrl(isStaging)}/admin/api/apps/${appId}/upload`,
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
    console.error('[uploadMobileBundle] Error:', error);
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

    const [iosBundle, androidBundle] = await Promise.all([
      generateIosBundle(appRoot),
      generateAndroidBundle(appRoot),
    ]);

    const iosTimestamp = iosBundle.bundleDestination.split('/').at(-2);
    const androidTimestamp = androidBundle.bundleDestination.split('/').at(-2);

    console.log('[main] Uploading iOS bundle:', iosTimestamp);
    console.log('[main] Uploading Android bundle:', androidTimestamp);

    const [iosResult, androidResult] = await Promise.all([
      uploadMobileBundle(iosTimestamp, 'ios'),
      uploadMobileBundle(androidTimestamp, 'android'),
    ]);

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

main(appId, forkId, branchName, publishedCommitId, isStaging)
  .then(() => {
    console.log('[main] Preview generation finished successfully!');
  })
  .catch(error => {
    console.error('[main] Preview generation failed!', error);
  });
