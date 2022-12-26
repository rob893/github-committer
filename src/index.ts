import { AzureFunction, Context } from '@azure/functions';
import { Octokit } from '@octokit/rest';

interface GitHubFile {
  path: string;
  mode: '100644' | '100755' | '040000' | '160000' | '120000';
  type: 'commit' | 'tree' | 'blob';
  sha?: string | null;
  content: string;
}

const timerTrigger: AzureFunction = async function (context: Context): Promise<void> {
  context.log('Starting trigger...');

  if (!process.env.GITHUB_PAT) {
    context.log.error('No value for GITHUB_PAT was set!!! Please ensure this environment variable is set. Exiting.');
    return;
  }

  const rand = Math.random();

  if (rand < 0.5) {
    context.log('Not performing commit this trigger.');
    return;
  }

  const octokit = new Octokit({
    auth: process.env.GITHUB_PAT
  });

  const owner = 'rob893';
  const repo = 'test-repository';

  const commits = await octokit.repos.listCommits({
    owner,
    repo
  });

  const commitSHA = commits.data[0].sha;

  const files = [
    {
      name: 'time.txt',
      contents: new Date().toString()
    }
  ];

  const commitableFiles: GitHubFile[] = files.map(({ name, contents }) => {
    return {
      path: name,
      mode: '100644',
      type: 'commit',
      content: contents
    };
  });

  const {
    data: { sha: currentTreeSHA }
  } = await octokit.git.createTree({
    owner,
    repo,
    tree: commitableFiles,
    base_tree: commitSHA,
    message: 'Updated programatically.',
    parents: [commitSHA]
  });

  context.log('Creating new commit...');
  const {
    data: { sha: newCommitSHA }
  } = await octokit.git.createCommit({
    owner,
    repo,
    tree: currentTreeSHA,
    message: `Updated programatically,`,
    parents: [commitSHA]
  });

  // Push commit to origin
  context.log('Pushing to origin...');
  await octokit.git.updateRef({
    owner,
    repo,
    sha: newCommitSHA,
    ref: 'heads/main'
  });

  context.log('Function complete!');
};

export default timerTrigger;
