import { describe, expect, it } from 'vitest';
import { buildClaudeCodeSystemPrompt } from '../prompt';

describe('buildClaudeCodeSystemPrompt', () => {
  it('includes interactive input guidance for codex-style tool references', () => {
    const prompt = buildClaudeCodeSystemPrompt({
      toolReferenceStyle: 'codex',
    });

    expect(prompt).toContain('## Interactive User Input');
    expect(prompt).toContain('`AskUserQuestion` (server: `nimbalyst-mcp`)');
    expect(prompt).toContain('`PromptForUserInput` (server: `nimbalyst-mcp`)');
    expect(prompt).toContain('call an interactive tool instead');
    expect(prompt).toContain('Combine multiple questions into one multi-field prompt');
  });

  it('formats interactive input tool references for claude-style prompts', () => {
    const prompt = buildClaudeCodeSystemPrompt({
      toolReferenceStyle: 'claude',
    });

    expect(prompt).toContain('`mcp__nimbalyst-mcp__AskUserQuestion`');
    expect(prompt).toContain('`mcp__nimbalyst-mcp__PromptForUserInput`');
  });

  it('keeps plan-only sessions in planning', () => {
    const prompt = buildClaudeCodeSystemPrompt({
      toolReferenceStyle: 'codex',
      hasSessionNaming: true,
    });

    expect(prompt).toContain('Update phase for plan-only work: `{ "phase": "planning" }`');
    expect(prompt).toContain('If the session only produced a plan/design/research artifact, it stays "planning"');
    expect(prompt).toContain('Use "validating" only after implementation exists and is being tested or reviewed.');
  });
});
