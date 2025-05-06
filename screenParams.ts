import { IFork, IForkWithBranches } from "./types/type";

export type ScreenParams = {
  PreviewHome: undefined,
  Scanner: undefined,
  Fork: {
    appId: string;
    forks: IFork[];
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
    branchId?: number;
  }
};