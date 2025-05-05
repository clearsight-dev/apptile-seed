import { IAppFork, IForkWithBranches } from "./types/type";

export type ScreenParams = {
  PreviewHome: undefined,
  Scanner: undefined,
  Fork: {
    appId: string;
    forks: IAppFork[];
  },
  Branch: {
    appId: string;
    branches: IForkWithBranches['branches'];
    forkId: number;
  },
  AppDetail: {
    appId: string;
    forkId: number;
    branchName: string;
  }
};