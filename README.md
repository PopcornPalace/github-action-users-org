
## Publish to a distribution branch

Actions are run from GitHub repos so we will checkin the packed dist folder. 

Then run [ncc](https://github.com/zeit/ncc) and push the results:
```bash
$ npm run package
$ name: Test Action
on:
  push:
    branches:
      - release

jobs:
  check-validation:
    runs-on: ubuntu-latest
    name: Check commit signing
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Check commit
        uses: ./
        id: check-commit
      - name: Show check-commit
        run: echo "${{ steps.check-commit.outputs.commit }}"

$ git commit -a -m "prod dependencies"
$ git push origin releases/v1
```

Note: We recommend using the `--license` option for ncc, which will create a license file for all of the production node modules used in your project.

Your action is now published! :rocket: 

## Validate

You can now validate the action by referencing `./` in a workflow in your repo 

```yaml
uses: ./
```

## Usage:


