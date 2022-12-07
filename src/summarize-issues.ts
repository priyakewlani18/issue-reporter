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
        
        for( var mt = 0; mt < configmonths; mt++){
            
            let current_date = new Date();
            const MONTHS_AGO = new Date(current_date.getFullYear(), current_date.getMonth(), 1);

            MONTHS_AGO.setMonth(MONTHS_AGO.getMonth() - mt);
            
            const month = MONTHS_AGO.toLocaleString('default', { month: 'long' });
            var date_text = MONTHS_AGO.toISOString().split('T')[0]

            const issues_open = await queryIssues(inputs.octokit, inputs.repoContext, configSection.labels, configSection.excludeLabels || [], date_text, 'open');
            const issues_closed = await queryIssues(inputs.octokit, inputs.repoContext, configSection.labels, configSection.excludeLabels || [], date_text, 'closed');
            issues.push({month_text : month,  issues_open: issues_open, issues_closed:issues_closed})

        }
        issues.pop() // pulling out last metrics as it would be incorrect always , because we don't have a base value

        sections.push({
            ...configSection,
            issues,
            status:""
        }); 
    };

    console.log('Generating the report Markdown ...');
    const report = generateReport(inputs.title, sections, inputs.repoContext);

    console.log(`Writing the Markdown to ${inputs.outputPath} ...`);
    fs.writeFileSync(inputs.outputPath, report, 'utf8');

    console.log('Done!');
}

// See https://octokit.github.io/rest.js/v17#issues-list-for-repo.
async function queryIssues(octokit: Octokit, repoContext: RepoContext, labels: string[], excludeLabels: string[], since: string, state:string): Promise<Issue[]> {
    return await octokit.paginate(
        // There's a bug in the Octokit type declaration for `paginate`.
        // It won't let you use the endpoint method as documented: https://octokit.github.io/rest.js/v17#pagination.
        // Work around by using the route string instead.
        //octokit.issues.listForRepo,
        "GET /repos/:owner/:repo/issues",
        {
            ...repoContext,
            labels: labels.join(','),
            state: 'closed',
            created:since   
        },
        (response: Octokit.Response<Octokit.IssuesListForRepoResponse>) => response.data.filter(issue => filterIssue(issue, excludeLabels)));
}

function filterIssue(issue: Octokit.IssuesListForRepoResponseItem, excludeLabels: string[]) {
    return !issue.pull_request && !issue.labels.some(label => excludeLabels.includes(label.name));
}

function generateReport(title: string, sections: Section[], repoContext: RepoContext): string {
    return Array.from([
        ...markdown.generateSummary(title, sections, repoContext),
        //...markdown.generateDetails(sections, repoContext)
    ]).join('\n');
}
