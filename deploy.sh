DEPLOY_BRANCH=develop
git checkout ${DEPLOY_BRANCH}
git fetch origin
git rebase
npm i
echo "restarting supervisor"
sudo supervisorctl restart gajiandulu
