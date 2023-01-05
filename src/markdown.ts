import type { Issue, RepoContext, Section, tableConfig } from './types';
import {arrayToTable} from "./convertotable"
import { getStatus } from './status';

export function* generateSummary(title: string, sections: Section[] [], tableData: tableConfig[]) {

    yield h3(title);
    yield p("The table below shows data for the last few weeks and open count since Oct'22 ,There might be some error(approximate data) as we are not tracing issues which are very old as we can not go back in history too much and we make a since query")

    for(var i = 0; i < sections.length; i++) {
        yield h3(tableData[i].tableTitle);

        yield '| Section Title | description | Labels | Threshold | Weekly Count | Totals Open Now since Oct 2022 | Status|';
        yield '| :--- |  :----: | :----: |  :----:  |  :----:  |  :----: | :----: ';

        for (const section of sections[i]) {
            yield* sectionSummary(section);
        }
    }
}

// export function* generateDetails(sections: Section[], repoContext: RepoContext) {
//     yield h2('Details');
//     for (const section of sections) {
//         yield* sectionDetails(section, repoContext);
//     }
// }

function createtableMonthly(sections:any){
    let headers:any = [];
    Object.keys(sections[0]).forEach( (key:any ,value:any, ) => headers.push({name:key}))
   
    let $heads = headers.map((hd:any) => `<th >${hd.name}</th>`);
    let $header = `<thead><tr>${$heads.join('')}</tr></thead>`;

    let $rows = sections.map((rowData:any) => {
        let $tds = headers.map((hd:any) => `<td >${rowData[hd.name] || '0'}</td>`);
        return `<tr>${$tds.join('')}</tr>`;
      });


      let $body = `<tbody>${$rows.join('')}</tbody>`;
      let rst = `<table>${$header} ${$body}</table>`;
      return rst;

} 

function* sectionSummary(section: Section) {
    // When generating header links, the red status needs some additional characters at the front because of the emoji it uses.
    // However GitHub-Flavored Markdown generates IDs for its headings, the other statuses aren't affected and just drop theirs.
    // It probably has to do with the Unicode ranges.
    const redStatusIdFragment = '%EF%B8%8F';
    
    let issueQuery = issuesQuery(section.repo, section.owner, section.labels, section.excludeLabels || [])

    let sectionAnchor = '#'
        + ('❤️🥵')
        + `-${hyphenate(section.section)}-query`;
     
    sectionAnchor = issueQuery
    let total_count_open = 0;
  

    let data_list = []
    for( const sect of section.issues){
        data_list.push({ week: sect.week_text , issues_open_count: (sect.issues_open_length), issues_close_count: (sect.issues_close_length) })

        total_count_open = sect.total_issues_open_length
    }
    let convertedata = createtableMonthly(data_list)
    const section_prefix =  `| ${link(section.section, sectionAnchor)} | ${section.description || "" }   | ${section.labels.map(code).concat((section.excludeLabels || []).map(x => strike(code(x)))).join(', ')} | ${section.threshold}|`
    let sectionstatus =  getStatus(total_count_open, section.threshold)

    yield  section_prefix + convertedata + `|`+ `${total_count_open}`+ `|` + `${sectionstatus}` + `|`;

    // yield `| ${link(section.section, sectionAnchor)} | ${section.labels.map(code).concat((section.excludeLabels || []).map(x => strike(code(x)))).join(', ')} | ${section.threshold} | ${section.issues.length} | ${section.status} |`;
}

function* sectionDetails(section: Section, repo: string, owner: string) {
    const owners = sumIssuesForOwners(section.issues);

    yield h3(`${section.section} ${link('(query)', issuesQuery(repo, owner, section.labels, section.excludeLabels || []))}`);
    yield `Total: ${section.issues.length}\n`;
    yield `Threshold: ${section.threshold}\n`;
    yield `Labels: ${section.labels.map(code).concat((section.excludeLabels|| []).map(x => strike(code(x)))).join(', ')}\n`
    yield '| Owner | Count |';
    yield '| -- | -- |';

    // Sort the table in descending order of issue count
    const ownersByIssueCount = Object.keys(owners).sort((a, b) => owners[b] - owners[a]);
    for (const key of ownersByIssueCount) {
        // `key` is the owner's login
        const queryUrl = issuesQuery(repo, owner, section.labels, section.excludeLabels || [], key);
        yield `| ${link(key, queryUrl)} | ${owners[key]} |`;
    }
}

// Markdown helpers -- not the least bit safe for handling user input, so don't copy these for general use.
const h2 = (text: string) => `## ${text}`;
const h3 = (text: string) => `### ${text}`;
const p = (text: string) => `${text}`;
const link = (text: string, href: string) => `[${text}](${href})`;
const code = (text: string) => `\`${text}\``;
const strike = (text: string) => `\~${text}\~`;

// Useful for converting a header name to an HTML ID in a hacky way
const hyphenate = (headerName: string) => headerName.replace(/\s+/g, '-');

/** Construct a URL like `https://github.com/brcrista/summarize-issues-test/issues?q=is%3Aissue+is%3Aopen+label%3Aincident-repair+label%3Ashort-term`. */
function issuesQuery(repo: string, owner: string, labels: string[], excludeLabels: string[], assignee?: string) {
    labels = makeLabelsUrlSafe(labels);
    excludeLabels = makeLabelsUrlSafe(excludeLabels);

    const queryInputs = ['is:issue','is:open']
        .concat(labels.map(label => `label:${label}`))
        .concat(excludeLabels.map(excludeLabel => `-label:${excludeLabel}`));

    if (assignee) {
        // Using a sentinel value is a hack, but it keeps the interface and implementation simple here.
        if (assignee === unassignedKey) {
            queryInputs.push(`no:assignee`);
        } else {
            queryInputs.push(`assignee:${assignee}`);
        }
    }

    // The `+` signs should not be encoded for the query to work.
    const queryString = queryInputs.map(encodeURIComponent).join('+');
    return `https://github.com/${owner}/${repo}/issues?q=${queryString}`;
}

function makeLabelsUrlSafe(labels: string[]) {
    // If the label contains a space, the query string needs to have it in quotes.
    return labels.map(label => {
        if (label.includes(' ')) {
            return `"${label}"`;
        } else {
            return label;
        }
    });
}

/** Get a mapping of owner logins to the number of issues they have in this section. */
function sumIssuesForOwners(issues: Issue[]) {
    const result: { [owner: string]: number } = {};

    for (const issue of issues) {
        if (issue.assignees.length > 0) {
            for (const owner of issue.assignees) {
                if (!result[owner.login]) {
                    result[owner.login] = 0;
                }
                result[owner.login] += 1
            }
        } else {
            if (!result[unassignedKey]) {
                result[unassignedKey] = 0;
            }
            result[unassignedKey] += 1
        }
    }

    return result;
}

// Note that this isn't a valid GitHub login, so it won't conflict with a potential owner.
// And yes, it is meant to be rendered as Markdown.
const unassignedKey = "**Unassigned**";