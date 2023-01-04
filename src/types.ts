import type { Octokit } from '@octokit/rest';

import type { Status } from './status';

// The type of `context` from `@actions/github`
export interface RepoContext { owner: string, repo: string }

export type Issue = Octokit.IssuesListForRepoResponseItem;

// What comes out of the config file
export interface ConfigSection {
    section: string,
    labels: string[],
    excludeLabels?: string[],
    threshold: number,
    months?:number,
    tableIndex?:number,
    since?: string,
    description?:string,
    repo?:string,
    owner?:string
}

export interface tableConfig {

    "tableTitle" : string
}

// What comes out of the config file plus whatever else we need to write the report
export type Section = ConfigSection & {
    issues: any,
    status: any
}