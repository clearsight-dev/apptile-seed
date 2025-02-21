import RNFetchBlob from 'rn-fetch-blob';

const localStorageFile = RNFetchBlob.fs.dirs.DocumentDir + '/localstorage.json';
const fileCreated = RNFetchBlob.fs.exists(localStorageFile)
  .then(exists => {
    if (!exists) {
      return RNFetchBlob.fs.createFile(localStorageFile, "{}", "utf8");
    }
  });

export function setItem(key: string, value: any): Promise<Record<string, any>> {
  return fileCreated
    .then(() => RNFetchBlob.fs.readFile(localStorageFile, 'utf8'))
    .then(data => {
      const store = JSON.parse(data);
      store[key] = value;
      return store;
    })
    .then(newData => {
      RNFetchBlob.fs.writeFile(localStorageFile, JSON.stringify(newData), 'utf8')
      return newData;
    });
}

export function getItem(key: string): Promise<any> {
  return fileCreated
    .then(() => RNFetchBlob.fs.readFile(localStorageFile, 'utf8'))
    .then(res => {
      let store: Record<string, string> = {}
      try {
        store = JSON.parse(res);
      } catch (err) {
        logger.error(err);
      }
      return store[key];
    })
    .catch(err => {
      logger.error(err);
    });
}
