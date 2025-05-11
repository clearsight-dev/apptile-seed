import RNFetchBlob from 'rn-fetch-blob';
import axios from 'axios';
import {getConfigValue} from 'apptile-core';

export async function download(url: string, savePath: string) {
  try {
    const res = await RNFetchBlob.config({
      fileCache: true,
      path: RNFetchBlob.fs.dirs.DocumentDir + '/' + savePath
    })
    .fetch('GET', url)
  } catch (err) {
    console.error("Failed to download: ", err);
  }
};

export async function downloadTransient({appId, forkId}: {appId: string; forkId: string|number;}) {
  try {
    const exists = await RNFetchBlob.fs.exists(`${RNFetchBlob.fs.dirs.DocumentDir}/temp/temp/temp/appConfig.json`)
    if (exists) {
      await RNFetchBlob.fs.unlink(`${RNFetchBlob.fs.dirs.DocumentDir}/temp/temp/temp/appConfig.json`)
    }
    const apiEndpoint = await getConfigValue('APPTILE_API_ENDPOINT');
    const {data: url} = await axios.get(`${apiEndpoint}/api/v2/app/${appId}/${forkId}/main/noRedirect`);
    await download(url, 'temp/temp/temp/appConfig.json')
  } catch(err) {
    console.error(err)
  }
}
