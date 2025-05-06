export type HomeState = {
    appId: null | string;
    hasError: boolean;
    errorMessage: string;
    pushLogs: {
        logs: Array<{
            androidBundleId: null | number;
            appId: string;
            comment: string;
            createdAt: string;
            id: number;
            iosBundleId: null | number;
            navigatorsBundleId: null | number;
            pluginsBundleId: null | number;
            publishedCommitId: null | number;
            updatedAt: string;
        }>;
        artefacts: Array<{
            id: number;
            type: "ios-jsbundle" | "android-jsbundle" | "navigator-bundle" | "plugin-bundle";
            cdnlink: string;
        }>;
    };
    manifest: {
        name: string;
        published: boolean;
        androidBundleId: null | number;
        iosBundleId: null | number;
        forks: Array<{
            id: string | number;
            title: string;
            publishedCommitId: number | null;
            mainBranchLatestSave: {
                commitId: number;
                cdnlink: string;
            };
        }>;
    };
    launchSequence: Array<{ label: string; status: "notstarted" | "inprogress" | "error" | "success" }>;
    showLaunchSequence: boolean;
};


export type DownloadNonCacheCodepushCb = (cdnlink: string, iosBundleId: number | null, androidBundleId: number | null) => Promise<void>;
export type DownloadCodepushCb = (publishedCommitId: number | null, iosBundleId: number | null, androidBundleId: number | null) => Promise<void>;
export type DispatchFcn = (action: HomeAction) => void;

export type HomeAction = { type: 'SET_APP_ID'; payload: string | null; } |
{ type: 'SET_ERROR'; payload: string; } |
{ type: 'SET_PUSHLOGS'; payload: HomeState['pushLogs']; } |
{ type: 'SET_MANIFEST'; payload: HomeState['manifest']; } |
{ type: 'SET_LAUNCH_SEQUENCE'; payload: HomeState['launchSequence']; } |
{ type: 'SET_LAUNCH_SEQUENCE_MODAL_VISIBILITY'; payload: HomeState['showLaunchSequence']; } |
{
  type: 'UPDATE_FORK_IN_MANIFEST';
  payload: {
    forkId: number | string;
    mainBranchLatestSave: {
      commitId: number;
      cdnlink: string;
    }
  }
}

export type ICodeArtefact = {
  id: number;
  type: string;
  cdnlink: string;
  tag: string;
};

export type IFork = {
  id: number;
  appId: number;
  frameworkVersion: string;
  forkName: string;
  title: string;
  publishedCommitId: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type IManifestResponse = {
  id: number;
  name: string;
  uuid: string;
  organizationId: string;
  published: boolean;
  isOnboarded: boolean;
  platformType: string;
  isEditorOnboarded: boolean;
  activeBlueprintUUID: string;
  gitRepo: string;
  iosBundleId: number | null;
  androidBundleId: number | null;
  pluginsBundleId: number | null;
  navigatorsBundleId: number | null;
  createdBy: string;
  updatedBy: string;
  deletedAt: string | null;
  latestBuildNumberIos: number | null;
  latestBuildNumberAndroid: number | null;
  latestBuildSemverIos: string | null;
  latestBuildSemverAndroid: string | null;
  appStorePermanentLink: string | null;
  playStorePermanentLink: string | null;
  createdAt: string;
  updatedAt: string;
  forks: IFork[];
  codeArtefacts: ICodeArtefact[];
}

export type IAppForksResponse = {
  id: number;
  name: string;
  uuid: string;
  organizationId: string;
  published: boolean;
  isOnboarded: boolean;
  platformType: string;
  isEditorOnboarded: boolean;
  activeBlueprintUUID: string | null;
  gitRepo: string | null;
  iosBundleId: number | null;
  androidBundleId: number | null;
  pluginsBundleId: number | null;
  navigatorsBundleId: number | null;
  createdBy: string;
  updatedBy: string;
  deletedAt: string | null;
  latestBuildNumberIos: number | null;
  latestBuildNumberAndroid: number | null;
  latestBuildSemverIos: string | null;
  latestBuildSemverAndroid: string | null;
  appStorePermanentLink: string | null;
  playStorePermanentLink: string | null;
  createdAt: string;
  updatedAt: string;
  forks: IFork[];
  codeArtefacts: ICodeArtefact[];
};

export type IBranch = {
  id: number;
  forkId: number;
  branchName: string;
  title: string;
  headCommitId: number;
  activePublishedCommitId: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type IForkWithBranches = {
  id: number;
  appId: number;
  frameworkVersion: string;
  forkName: string;
  title: string;
  publishedCommitId: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  branches: IBranch[];
};

export type IAppDraftResponse = {
  appDraft: {
    id: number;
    appId: string;
    commitId: number;
    forkId: number;
    branchId: number;
    androidBundleUrl: string | null;
    iosBundleUrl: string | null;
    navigatorsBundleUrl: string | null;
    pluginsBundleUrl: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  };
};

export type ILastSavedConfigResponse = {
  url: string;
};