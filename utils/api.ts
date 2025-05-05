import axios from 'axios';
import { IForkWithBranches } from '../types/type';
// import {getConfigValue} from 'apptile-core';


export async function fetchBranchesApi(appId: string | number, forkId: string | number): Promise<IForkWithBranches> {
  // const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
  const APPTILE_API_ENDPOINT = 'http://localhost:3000';
  const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/fork/${forkId}/branches`;
  const response = await axios.get<IForkWithBranches>(url);
  return response.data;
} 