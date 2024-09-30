Simple Instructions
First, to install the latest version of Wasp on macOS, Linux, or Windows with WSL, run the following command:

'''curl -sSL https://get.wasp-lang.dev/installer.sh | sh'''

oc create secret generic github-deploy-key --from-file=ssh-privatekey=/Users/florian/.ssh/my_github_deploy_key --type=kubernetes.io/ssh-auth

oc secrets link builder pull-secret --for=pull


cd app
wasp build 
cd
wasp build 
cd .wasp/build/web-app/
npm ci && REACT_APP_API_URL=opensaas-backend.florian-ns.svc.cluster.local:3001 npm run build
