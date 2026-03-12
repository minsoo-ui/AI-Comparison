const { execSync } = require('child_process');

function runCommand(command) {
    try {
        return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
        return error.stdout || error.stderr || '';
    }
}

async function sync() {
    console.log('🚀 Starting GitHub Auto-Sync...');

    try {
        // 1. Check for changes
        const status = runCommand('git status --porcelain');
        if (!status) {
            console.log('✅ No changes to sync. Everything is up to date.');
            return;
        }

        console.log('📝 Changes detected, preparing to push...');

        // 2. Add all changes
        runCommand('git add .');

        // 3. Commit with timestamp
        const timestamp = new Date().toLocaleString();
        const commitMessage = `Auto-backup: ${timestamp}`;
        runCommand(`git commit -m "${commitMessage}"`);

        // 4. Push to main
        console.log('☁️ Pushing to GitHub repository...');
        const pushResult = runCommand('git push origin main');

        console.log('✅ Sync completed successfully!');
        console.log(pushResult);
    } catch (error) {
        console.error('❌ Error during GitHub sync:', error.message);
    }
}

sync();
