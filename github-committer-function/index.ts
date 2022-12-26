import { AzureFunction, Context } from '@azure/functions';
import { Octokit } from '@octokit/rest';
import { bindLinqToNativeTypes } from 'typescript-extended-linq';
import { GitHubFile } from './models';

bindLinqToNativeTypes();

const reposToIgnore = new Set([
  'algo-visualizer',
  'wow-market-watcher',
  'typescript-extended-linq',
  'typescript-lru-cache',
  'Entropy-Game-Engine',
  'PHP-OData-Query-Builder',
  'emoji-cache',
  'Workout-App',
  'benchmark-scripts',
  'personal-portfolio-3d',
  'extension-methods-js',
  'Application-Health-Checker',
  'money-manager-service',
  'dotnet-packages',
  'wow-market-watcher-ui',
  'wow-declarations'
]);

const githubCommitterFunction: AzureFunction = async function (context: Context): Promise<void> {
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

  const repos = await octokit.repos.listForUser({
    username: owner,
    // eslint-disable-next-line camelcase
    per_page: 100
  });

  const reposMinusExcluded = repos.data.exceptBy(reposToIgnore, x => x.name).toArray();

  context.log(
    `${repos.data.length} total repos found. ${reposToIgnore.size} will be ommitted. ${reposMinusExcluded.length} repos to choose from.`
  );

  const repo = reposMinusExcluded.shuffle().first().name;

  context.log(`A new commit will be created for ${repo}`);

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
    // eslint-disable-next-line camelcase
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
    ref: 'heads/master'
  });

  context.log('Function complete!');
};

export default githubCommitterFunction;
