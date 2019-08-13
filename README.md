# ESLint Check Action

Run ESLint as part of a GitHub workflow. This action will also annotate the
diff with the errors and warnings reported by ESLint.

## Usage

```
name: "Lint"

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: npm install
        run: npm install

      - uses: dpogue/eslint-check-action@v1.0.0
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
```

You can run this in parallel with your tests by making use of multiple jobs.
