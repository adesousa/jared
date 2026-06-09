---
name: github
description: "Interact with GitHub using the `gh` CLI. Use `gh issue`, `gh pr`, `gh run`, and `gh api` for issues, PRs, CI runs, and advanced queries."
---

# GitHub Skill

Use the `gh` CLI via the `run_terminal_command` tool to interact with GitHub. Always specify `--repo owner/repo` when not in a git directory, or use URLs directly. 

## Important Usage Warnings

- **Avoid certain characters:** Commands that include certain characters or keywords that are not in the allowed list (like `#`, `Rank`, etc.) will fail. Always check what is permitted in your command output.
- **Check output formats:** Ensure that your output does not unintentionally include disallowed formats like ranks or headers unless specified in the allowed output list.

## Pull Requests

Check CI status on a PR:

```bash
gh pr checks 55 --repo owner/repo
```

List recent workflow runs:

```bash
gh run list --repo owner/repo --limit 10
```

View a run and see which steps failed:

```bash
gh run view <run-id> --repo owner/repo
```

View logs for failed steps only:

```bash
gh run view <run-id> --repo owner/repo --log-failed
```

## API for Advanced Queries

The `gh api` command is useful for accessing data not available through other subcommands. 

Get PR with specific fields:

```bash
gh api repos/owner/repo/pulls/55 --jq '.title, .state, .user.login'
```

## JSON Output

Most commands support `--json` for structured output. You can use `--jq` to filter:

```bash
gh issue list --repo owner/repo --json number,title --jq '.[] | "\(.number): \(.title)"'
```

## Tips for Using Terminal Commands

- **Format your commands properly:** Ensure you’re not trying to output content that might be restricted or formatted in a way that could lead to blocked commands. For instance, commands should avoid using unallowed words or special characters.
- **Verify the output context:** When working with `cat`, `echo`, or similar commands, make sure you are not including disallowed terms or structures at the start of the output.
- **Use placeholders cautiously:** When using commands like `cat` with multiline input, confirm that each line adheres to the requirements of the expected output.

### Examples of Avoided Outputs

Use plain lists instead of enumerated or ranked outputs:
```bash
# Avoid headers like this
# Example of a blocked output structure:
# Rank, Title, etc.
```

When listing items, write in a simple format:
```bash
echo "Item: Description: URL" > output.txt
```

By following these guidelines and tips, you can effectively utilize the GitHub skill without encountering common errors.