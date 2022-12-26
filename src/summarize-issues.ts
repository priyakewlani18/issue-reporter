import * as fs from 'fs';

import type { Octokit } from '@octokit/rest';

import * as markdown from './markdown';

import type { ConfigSection, RepoContext, Section, Issue } from './types';

export async function run(inputs: {
    title: string,
    configPath: string,
    outputPath: string,
    octokit: Octokit,
    repoContext: RepoContext
}) {
    console.log(`Reading the config file at ${inputs.configPath} ...`);
    const config = fs.readFileSync(inputs.configPath, 'utf8');
    const configSections: ConfigSection[] = JSON.parse(config);

    console.log('Querying for issues ...');
    const sections : Section [] =  [];

    for (const configSection of configSections) {
        let issues =[];
        let configmonths = configSection.months || 3;

        let week_string = ['This Week', 'Last Week', 'Last Week Ago'];
        let total_issues_open_length = 0;
        var issues_open_count = 0;
        
        for( var mt = 0; mt < 3; mt++){
            
            let current_date = new Date();
            let day = current_date.getDay();
            

            let diff = current_date.getDate() - day + (day == 0 ? -6:1) - 7 * mt;
            let start_date = new Date(current_date.setDate(diff)) //start of the week
            let end_date = new Date(current_date.setDate(diff + 6)) //end of the week


            const total_issues_start_date = new Date("2022-10-01");

            let total_issues_start_date_text = total_issues_start_date.toISOString().split('T')[0]
            let start_date_text = start_date.toISOString().split('T')[0]
            let end_date_text = end_date.toISOString().split('T')[0]
       
            // open issues till current date
            if (mt===0) {
                const total_issues_open = await queryIssues(inputs.octokit, inputs.repoContext, configSection.labels, configSection.excludeLabels || [], total_issues_start_date_text, start_date_text, 'open'); //total Issues open since Oct 2021.
                total_issues_open_length = total_issues_open.length;// total issues open from october till current date
                issues_open_count = total_issues_open_length;
            }

            issues.push({week_text : week_string[mt],  issues_open_length: issues_open_count, total_issues_open_length: total_issues_open_length})

            const issues_open = await queryIssues(inputs.octokit, inputs.repoContext, configSection.labels, configSection.excludeLabels || [], start_date_text, end_date_text, 'open');
            const issues_closed = await queryIssues(inputs.octokit, inputs.repoContext, configSection.labels, configSection.excludeLabels || [], start_date_text, end_date_text, 'closed');
            var issues_close_count = issues_closed.length;
            issues_open_count = issues_open_count + issues_close_count - issues_open.length; //issue open count of the previous week

        }

        sections.push({
            ...configSection,
            issues,
            status:""
        }); 
    };

    console.log('Generating the report Markdown ...');
    const report1 = generateReport(inputs.title, sections, inputs.repoContext);
    const report2 = generateReport(inputs.title, sections, inputs.repoContext);

    console.log(`Writing the Markdown to ${inputs.outputPath} ...`);
    fs.writeFileSync(inputs.outputPath, report1, 'utf8');
    fs.writeFileSync(inputs.outputPath, report2, 'utf8');

    console.log('Done!');
}

// See https://octokit.github.io/rest.js/v17#issues-list-for-repo.
async function queryIssues(octokit: Octokit, repoContext: RepoContext, labels: string[], excludeLabels: string[], start_date_text: string, end_date_text: string, state:string): Promise<Issue[]> {
    return await octokit.paginate(
        // There's a bug in the Octokit type declaration for `paginate`.
        // It won't let you use the endpoint method as documented: https://octokit.github.io/rest.js/v17#pagination.
        // Work around by using the route string instead.
        //octokit.issues.listForRepo,
        "GET /repos/:owner/:repo/issues",
        {
            ...repoContext,
            labels: labels.join(','),
            state: state   
        },
        (response: Octokit.Response<Octokit.IssuesListForRepoResponse>) => response.data.filter(issue => filterIssue(issue, excludeLabels, start_date_text, end_date_text, state)));
}

function filterIssue(issue: Octokit.IssuesListForRepoResponseItem, excludeLabels: string[], start_date_text: string, end_date_text: string, state:string) {
    if (state === 'open')
        return !issue.pull_request && !issue.labels.some(label => excludeLabels.includes(label.name)) && (issue.created_at >=start_date_text && issue.created_at <= end_date_text) ;
    if (state === 'closed' && issue.closed_at)
        return !issue.pull_request && !issue.labels.some(label => excludeLabels.includes(label.name)) && (issue.closed_at>=start_date_text && issue.closed_at <= end_date_text);
}

function generateReport(title: string, sections: Section[], repoContext: RepoContext): string {
    return Array.from([
        ...markdown.generateSummary(title, sections, repoContext),
        //...markdown.generateDetails(sections, repoContext)
    ]).join('\n');
}
