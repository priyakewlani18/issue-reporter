import * as fs from 'fs';

import type { Octokit } from '@octokit/rest';

import * as markdown from './markdown';

import type { ConfigSection, RepoContext, Section, Issue, tableConfig } from './types';

export async function run(inputs: {
    title: string,
    configPath: string,
    outputPath: string,
    tableConfigPath: string,
    octokit: Octokit,
    octokitRemoteRepo: Octokit,
    repoContext: RepoContext
}) {
    console.log(`Reading the config file at ${inputs.configPath} ...`);
    console.log(`Repo Context data ${inputs.repoContext.owner} ${inputs.repoContext.repo}`)
    const config = fs.readFileSync(inputs.configPath, 'utf8');
    const tableConfigData = fs.readFileSync(inputs.tableConfigPath, 'utf8');
    const configSections: ConfigSection[] = JSON.parse(config);
    const tableData : tableConfig[] = JSON.parse(tableConfigData);

    console.log('Querying for issues ...');
    const sections : Section [][] =  [];
    const tableLength = tableData.length;

    let octokit = inputs.octokit;
    let repo = inputs.repoContext.repo;
    let owner = inputs.repoContext.owner;

    for (var i = 0; i < tableLength; i++) {
        sections [i] =  [];
    }

    for (const configSection of configSections) {
        let issues =[];
        let configmonths = configSection.months || 3;
        let sec_index = (configSection.tableIndex - 1 )|| 0;
 

        if(configSection.repo) {
            octokit = inputs.octokitRemoteRepo;
            repo = configSection.repo;
            owner = configSection.owner;
       
        }

        let week_string = ['This Week', 'Last Week', 'Two Weeks Ago'];
        let total_issues_open_length = 0;
        let issues_open_count = 0;
        let issues_close_count = 0;
        
        for( let mt = 0; mt < 3; mt++){
        
            let current_date = new Date();
            let day = current_date.getDay();
            
            let diff = current_date.getDate() - day + (day == 0 ? -6:1) - 7 * mt;
            let start_date = new Date(current_date.setDate(diff)) //start of the week
            current_date = new Date(); //again set the current date to present
            let end_date = new Date(current_date.setDate(diff + 7)) //end of the week



            const total_issues_start_date = new Date("2022-10-01"); // total issues since 1st October 2022

            let total_issues_start_date_text = total_issues_start_date.toISOString()
            let start_date_text = start_date.toISOString()
            let end_date_text = end_date.toISOString()
       
            // open issues till current date
            if (mt===0) {
                const total_issues_open = await queryIssues(octokit, repo, owner, configSection.labels, configSection.excludeLabels || [], total_issues_start_date_text, end_date_text, 'open'); //total Issues open since Oct 2021.
                total_issues_open_length = total_issues_open.length;// total issues open from october till current date
            }

            console.log(`Label ${configSection.labels} Start Date ${start_date_text} End Date ${end_date_text}`)

            const issues_open = await queryIssues(octokit, repo, owner, configSection.labels, configSection.excludeLabels || [], start_date_text, end_date_text, 'all');
            const issues_closed = await queryIssues(octokit, repo, owner, configSection.labels, configSection.excludeLabels || [], start_date_text, end_date_text, 'closed');
            
             
             issues_open_count = issues_open.length;
             issues_close_count = issues_closed.length;

             for( let index = 0; index < issues_open_count; index++){

                console.log(`Issues Data - Label ${configSection.labels} , Issue open url ${issues_open[index].url}`);
            
             }

             for( let index = 0; index < issues_close_count; index++){

                console.log(`Issues Data - Label ${configSection.labels} , Issue close url ${issues_closed[index].url}`);
            
             }

            issues.push({week_text : week_string[mt],  issues_open_count: issues_open_count, issues_close_count: issues_close_count, total_issues_open_length: total_issues_open_length, repo: repo, owner: owner})
            //issues_open_count = issues_open_count + issues_close_count - issues_open.length; //issue open count of the previous week

        }

        sections[sec_index].push({
            ...configSection,
            issues,
            status:""
        }); 

    };

    console.log('Generating the report Markdown ...');
    const report = generateReport(inputs.title, sections, tableData);

    console.log(`Writing the Markdown to ${inputs.outputPath} ...`);
    fs.writeFileSync(inputs.outputPath, report, 'utf8');

    console.log('Done!');
}

// See https://octokit.github.io/rest.js/v17#issues-list-for-repo.
async function queryIssues(octokit: Octokit, repo: string, owner: string, labels: string[], excludeLabels: string[], start_date_text: string, end_date_text: string, state:string): Promise<Issue[]> {
    return await octokit.paginate(
        // There's a bug in the Octokit type declaration for `paginate`.
        // It won't let you use the endpoint method as documented: https://octokit.github.io/rest.js/v17#pagination.
        // Work around by using the route string instead.
        //octokit.issues.listForRepo,
        "GET /repos/:owner/:repo/issues",
        {
            repo,
            owner,
            labels: labels.join(','),
            state: state
        },
        (response: Octokit.Response<Octokit.IssuesListForRepoResponse>) => response.data.filter(issue => filterIssue(issue, excludeLabels, start_date_text, end_date_text, state)));
}

function filterIssue(issue: Octokit.IssuesListForRepoResponseItem, excludeLabels: string[], start_date_text: string, end_date_text: string, state:string) {
    if (state === 'open' || state === 'all')
        return !issue.pull_request && !issue.labels.some(label => excludeLabels.includes(label.name)) && (issue.created_at >=start_date_text && issue.created_at < end_date_text) ;
    if (state === 'closed' && issue.closed_at)
        return !issue.pull_request && !issue.labels.some(label => excludeLabels.includes(label.name)) && (issue.closed_at>=start_date_text && issue.closed_at < end_date_text);
}

function generateReport(title: string, sections: Section[][], tableData: tableConfig[]): string {
    return Array.from([
        ...markdown.generateSummary(title, sections, tableData),
        //...markdown.generateDetails(sections, repoContext)
    ]).join('\n');
}
