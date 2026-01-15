---
description: Refine an existing implementation plan based on user-specified improvements
argument-hint: [path-to-plan] [refinement-prompt]
allowed-tools: Read, Write, Edit, Glob, Grep
model: opus
---

# Refine Plan

Refine an existing implementation plan by validating file references, improving implementation steps, and enhancing clarity. Follow the `Workflow` to analyze and improve the plan, then `Report` the changes made.

## Variables

PLAN_PATH: $1
USER_PROMPT: $2

## Instructions

- IMPORTANT: If no `PLAN_PATH` is provided, STOP immediately and ask the user to provide it.
- IMPORTANT: If no `USER_PROMPT` is provided, STOP immediately and ask the user what specific refinements they want made to the plan.
- The `USER_PROMPT` tells you exactly what the user wants refined - focus your efforts there first
- Read the entire plan file before making any changes
- Validate that the plan follows the standard format (has required sections)
- Focus refinements based on the `USER_PROMPT`, which may include:
  1. **File References**: Validate paths exist, add line numbers where relevant
  2. **Implementation Steps**: Make vague steps specific with code examples
  3. **Acceptance Criteria**: Ensure each criterion is measurable and testable
  4. **Validation Commands**: Verify commands are syntactically correct and would work
  5. **Technical Accuracy**: Check that described patterns match actual codebase
  6. **Custom Refinement**: Any specific improvement requested in `USER_PROMPT`
- Do NOT change the core intent or scope of the plan
- Preserve the original author's structure and approach
- Add improvements incrementally, documenting each change

## Workflow

1. **Read Plan** - Load the entire plan from `PLAN_PATH`, understand its scope and intent

2. **Validate Structure** - Check that the plan has these required sections:
   - Task Description
   - Objective
   - Relevant Files
   - Step by Step Tasks
   - Acceptance Criteria
   - Validation Commands

3. **Validate File References** - For each file mentioned in "Relevant Files":
   - Use Glob to verify the file exists
   - If file doesn't exist, search for similar files
   - For existing files, read key sections to find relevant line numbers
   - Update references to include line numbers (e.g., `file.py:45-60`)

4. **Improve Implementation Steps** - For each step in "Step by Step Tasks":
   - Check if step is vague (e.g., "update the file", "add functionality")
   - If vague, explore referenced files to understand exact changes needed
   - Add code snippets or pseudo-code where helpful
   - Ensure steps are atomic and actionable

5. **Enhance Acceptance Criteria** - For each criterion:
   - Check if it's measurable (has specific expectations)
   - Add specific values, counts, or behaviors where missing
   - Convert vague criteria to concrete checkable items

6. **Validate Commands** - For each validation command:
   - Check syntax is correct
   - Verify referenced files/paths would exist after implementation
   - Add missing validation commands for key acceptance criteria

7. **Research Gaps** - Identify and fill any missing context:
   - Problem Statement unclear? → Research codebase to clarify
   - Solution Approach vague? → Add technical details
   - Missing dependencies? → Identify and document

8. **Save Refined Plan** - Write the improved plan back to `PLAN_PATH`

9. **Report Changes** - Summarize all improvements made

## Report

After refining the plan, provide a summary:

```
✅ Plan Refined Successfully

File: PLAN_PATH
Changes Made:
- [count] file references validated/updated
- [count] implementation steps improved
- [count] acceptance criteria enhanced
- [count] validation commands verified

Key Improvements:
- <describe major improvement 1>
- <describe major improvement 2>
- <describe major improvement 3>

Files Referenced:
- <list files explored for context>
```