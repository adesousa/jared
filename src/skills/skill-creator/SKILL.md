---
name: skill-creator
description: Create new skills. Use when designing, structuring, or packaging skills with scripts, references, and assets.
---

# Skill Creator

This skill provides guidance for creating new Jared skills.

## Anatomy of a Skill

Every skill consists of a required SKILL.md file and optional bundled resources:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description)
│   └── Markdown instructions
└── Optional Resources
    ├── scripts/       - Executable code (Python/Bash/etc.)
    ├── references/    - Documentation loaded into context as needed
    └── assets/        - Files used in output (templates, icons, etc.)
```

## SKILL.md Format

- **Frontmatter** (YAML): Contains `name` and `description` fields.
- **Body** (Markdown): Instructions for using the skill.

## Creating a New Skill

1. Create a new folder in `src/skills/` with the skill name
2. Create `SKILL.md` with YAML frontmatter and markdown instructions
3. Add any scripts, references, or assets as needed
4. Restart Jared to load the new skill

## Skill Naming

- Use lowercase letters, digits, and hyphens only
- Prefer short, verb-led phrases that describe the action
- Name the skill folder exactly after the skill name

## Core Principles

### Concise is Key

The context window is a shared resource. Only add context the agent doesn't already have. Prefer concise examples over verbose explanations.

### Progressive Disclosure

Skills use a three-level loading system:

1. **Metadata (name + description)** - Always in context (~100 words)
2. **SKILL.md body** - Loaded when skill triggers (<5k words)
3. **Bundled resources** - As needed by the agent
