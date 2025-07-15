const {exec} = require('child_process');
const {createReadStream} = require('fs');
const {writeFile, mkdir, readdir, readFile} = require('node:fs/promises');
const path = require('path');
const archiver = require('archiver');
const axios = require('axios');

const appId = process.argv[2];
const forkId = process.argv[3];
const branchName = process.argv[4];
const publishedCommitId = process.argv[5];
const isStaging = process.argv[6];

const appRoot = __dirname;

console.log(
  'Received arguments:',
  appId,
  forkId,
  branchName,
  publishedCommitId,
  isStaging,
);

const toCamelCase = kebabCaseName => {
  const words = kebabCaseName.split('-');
  for (let i = 1; i < words.length; ++i) {
    words[i] = words[i][0].toUpperCase() + words[i].slice(1);
  }
  return words.join('');
};

const getBackendUrl = (isStaging = false) => {
  return isStaging ? 'https://dev-api.apptile.io' : 'https://api.apptile.io';
};

const metroCodegenPlugins = async (remoteCode = '', pluginNames = []) => {
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
      const parsedMeta = JSON.parse(metadata);
      entry = parsedMeta.entry;
    } catch (err) {
      console.error('Metadata file not found for plugin ', name);
    }
    const camelCasePackageName = toCamelCase(name);
    contents =
      `import ${camelCasePackageName} from "./plugins/${name}/${entry}";\n` +
      contents;
    contents += `    ${camelCasePackageName},\n`;
  }
  contents = '// This file is generated. Do not edit.\n' + contents + '  ];\n}';
  const iosRemoteEntryPath = path.resolve(remoteCode, 'index.js');
  await writeFile(iosRemoteEntryPath, contents);
};

const metroCodegenNavs = async (remoteCode = '', navNames = []) => {
  let contents = `import {registerCreator} from 'apptile-core';
export const navs = [
`;
  for (let name of navNames) {
    const camelCasePackageName = toCamelCase(name);
    contents =
      `import ${camelCasePackageName} from "./navigators/${name}/source";\n` +
      contents;
    contents += `  {creator: ${camelCasePackageName}, name: "${name}"},\n`;
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
};

const ensurePlugins = async path => {
  try {
    await stat(path);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      await mkdir(path, {recursive: true});
    }
  }
};

const generateIosBundle = async () => {
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

  const extraModulesPath = path.resolve(remoteCode, 'extra_modules.json');

  try {
    await stat(extraModulesPath);
  } catch (error) {
    const iosProjectSetupPath = path.resolve(appRoot, 'iosProjectSetup.js');
    await new Promise((resolve, reject) => {
      exec(
        `node ${iosProjectSetupPath}`,
        {
          cwd: path.resolve(appRoot),
        },
        (err, stdout, stderr) => {
          if (err) {
            console.error(err);
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
          console.error(err);
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
      reject(err);
    });
    const archive = archiver('zip', {zlib: {level: 9}});
    archive.on('warning', wrn => {
      console.warn('archiver warning: ', wrn);
    });

    archive.on('error', err => {
      if (err) {
        console.error('Failure in archiver ', err);
      }
    });
    archive.pipe(writeStream);

    archive.file(path.resolve(appRoot, 'ios/main.jsbundle'), {
      name: 'main.jsbundle',
    });
    archive.directory(path.resolve(appRoot, 'ios/bundleassets'), false);
    archive.finalize();
  });
};

const generateAndroidBundle = async () => {
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

  const extraModulesPath = path.resolve(remoteCode, 'extra_modules.json');

  try {
    await stat(extraModulesPath);
  } catch (error) {
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
            console.error(err);
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
          console.error(err);
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
      reject(err);
    });
    const archive = archiver('zip', {zlib: {level: 9}});
    archive.on('warning', wrn => {
      console.warn('archiver warning: ', wrn);
    });

    archive.on('error', err => {
      if (err) {
        console.error('Failure in archiver ', err);
      }
    });
    archive.pipe(writeStream);

    archive.file(
      path.resolve(appRoot, 'android/app/src/main/assets/index.android.bundle'),
      {name: 'index.android.bundle'},
    );
    archive.directory(
      path.resolve(appRoot, 'android/app/src/main/assets/assets'),
      false,
    );
    archive.finalize();
  });
};

const getGitShas = async () => {
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
    return {err: false, gitsha, sdksha};
  } catch (err) {
    return {err};
  }
};

const getMobileBundle = async (bundleName, os) => {
  try {
    const assetZip = path.resolve(
      `remoteCode/generated/bundles/${os}`,
      bundleName,
      'bundle.zip',
    );
    await stat(assetZip);
    return {err: false, assetZip};
  } catch (err) {
    return {err};
  }
};

const makeHeaders = (extraHeaders = {}) => {
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
  return {
    headers: header,
  };
};

const uploadMobileBundle = async (bundleName, os) => {
  const {err: bundleErr, assetZip} = await getMobileBundle(
    appId,
    bundleName,
    os,
  );
  if (bundleErr || !assetZip) {
    throw new Error(
      `Failed to retrieve bundle: ${bundleErr || 'Asset zip not found'}`,
    );
  }

  const {err, gitsha, sdksha} = await getGitShas();
  if (err) {
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

  if (response.status >= 400) {
    try {
      const errorMessage = response.data;
      throw new Error(`Failed to upload: ${errorMessage}`);
    } catch (err) {
      console.error('Unprocessable error:', err);
      throw err;
    }
  }

  return {
    status: response.status,
    data: response.data,
  };
};

const main = async (
  appId,
  forkId,
  branchName,
  publishedCommitId,
  isStaging,
) => {
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

    const [iosResult, androidResult] = await Promise.all([
      uploadMobileBundle(iosTimestamp, 'ios'),
      uploadMobileBundle(androidTimestamp, 'android'),
    ]);

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

      if (draftResult.status >= 400) {
        try {
          const errorMessage = draftResult.data;
          throw new Error(`Failed to create draft: ${errorMessage}`);
        } catch (err) {
          console.error('Unprocessable error:', err);
          throw err;
        }
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  } catch (error) {
    console.error(error);
  }
};

main(appId, forkId, branchName, publishedCommitId, isStaging)
  .then(() => {
    console.log('Preview generation finished successfully!');
  })
  .catch(error => {
    console.error('Preview generation failed!', error);
  });
