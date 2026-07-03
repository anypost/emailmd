import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CLI = resolve(__dirname, '../dist/cli.js');
const FIXTURE = resolve(__dirname, 'fixtures/transactional.md');

// Helper to run the CLI
function run(args: string[], input?: string): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      encoding: 'utf-8',
      input,
      timeout: 10_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      status: err.status ?? 1,
    };
  }
}

describe('cli', () => {
  describe('--help', () => {
    it('prints help and exits with code 0', () => {
      const { stdout, status } = run(['--help']);
      expect(status).toBe(0);
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('--help');
      expect(stdout).toContain('--text');
      expect(stdout).toContain('--output');
    });

    it('works with the -h shorthand', () => {
      const { stdout, status } = run(['-h']);
      expect(status).toBe(0);
      expect(stdout).toContain('Usage:');
    });
  });

  describe('--version', () => {
    it('prints the version and exits with code 0', () => {
      const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
      const { stdout, status } = run(['--version']);
      expect(status).toBe(0);
      expect(stdout.trim()).toBe(pkg.version);
    });

    it('works with the -v shorthand', () => {
      const { stdout, status } = run(['-v']);
      expect(status).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('rendering from a file', () => {
    it('outputs HTML to stdout', () => {
      const { stdout, status } = run([FIXTURE]);
      expect(status).toBe(0);
      expect(stdout).toContain('<!doctype html>');
      expect(stdout).toContain('Order Confirmed');
    });

    it('outputs plain text with --text', () => {
      const { stdout, status } = run([FIXTURE, '--text']);
      expect(status).toBe(0);
      expect(stdout).not.toContain('<!doctype html>');
      expect(stdout).toContain('ORDER CONFIRMED');
    });

    it('works with the -t shorthand', () => {
      const { stdout, status } = run([FIXTURE, '-t']);
      expect(status).toBe(0);
      expect(stdout).not.toContain('<!doctype html>');
      expect(stdout).toContain('ORDER CONFIRMED');
    });
  });

  describe('rendering from stdin', () => {
    it('outputs HTML from stdin', () => {
      const { stdout, status } = run([], '# Hello from stdin');
      expect(status).toBe(0);
      expect(stdout).toContain('<!doctype html>');
      expect(stdout).toContain('Hello from stdin');
    });

    it('outputs plain text from stdin with --text', () => {
      const { stdout, status } = run(['--text'], '# Hello from stdin');
      expect(status).toBe(0);
      expect(stdout).not.toContain('<!doctype html>');
      expect(stdout).toContain('HELLO FROM STDIN');
    });
  });

  describe('-o / --output', () => {
    const OUT = resolve(__dirname, '../tmp-cli-test-output.html');

    // Cleanup after each test
    function cleanup() {
      if (existsSync(OUT)) unlinkSync(OUT);
    }

    it('writes HTML to a file', () => {
      try {
        const { status } = run([FIXTURE, '-o', OUT]);
        expect(status).toBe(0);
        const content = readFileSync(OUT, 'utf-8');
        expect(content).toContain('<!doctype html>');
        expect(content).toContain('Order Confirmed');
      } finally {
        cleanup();
      }
    });

    it('writes plain text to a file with --text', () => {
      try {
        const { status } = run([FIXTURE, '--text', '--output', OUT]);
        expect(status).toBe(0);
        const content = readFileSync(OUT, 'utf-8');
        expect(content).not.toContain('<!doctype html>');
        expect(content).toContain('ORDER CONFIRMED');
      } finally {
        cleanup();
      }
    });
  });

  describe('--minify', () => {
    it('produces a smaller HTML output than the default', () => {
      const normal = run([FIXTURE]);
      const minified = run([FIXTURE, '--minify']);
      expect(normal.status).toBe(0);
      expect(minified.status).toBe(0);
      expect(minified.stdout.length).toBeLessThan(normal.stdout.length);
      expect(minified.stdout).toContain('Order Confirmed');
    });

    it('works with the -m shorthand', () => {
      const normal = run([FIXTURE]);
      const minified = run([FIXTURE, '-m']);
      expect(minified.status).toBe(0);
      expect(minified.stdout.length).toBeLessThan(normal.stdout.length);
    });
  });

  describe('--beautify', () => {
    it('produces more lines of output than the default', () => {
      const normal = run([FIXTURE]);
      const beautified = run([FIXTURE, '--beautify']);
      expect(normal.status).toBe(0);
      expect(beautified.status).toBe(0);
      expect(beautified.stdout.split('\n').length).toBeGreaterThan(normal.stdout.split('\n').length);
      expect(beautified.stdout).toContain('Order Confirmed');
    });

    it('works with the -b shorthand', () => {
      const normal = run([FIXTURE]);
      const beautified = run([FIXTURE, '-b']);
      expect(beautified.status).toBe(0);
      expect(beautified.stdout.split('\n').length).toBeGreaterThan(normal.stdout.split('\n').length);
    });
  });

  describe('--partials', () => {
    const PARTIALS_DIR = resolve(__dirname, 'fixtures/partials');

    it('loads partials from a directory, subdirectories as name prefixes', () => {
      const input = '# Hi\n\n::: include signoff team="Acme"\n\n::: include blocks/legal';
      const { stdout, status } = run(['--partials', PARTIALS_DIR], input);
      expect(status).toBe(0);
      expect(stdout).toContain('The Acme Team');
      expect(stdout).toContain('https://example.com/unsub');
    });

    it('works with the -p shorthand', () => {
      const { stdout, status } = run(['-p', PARTIALS_DIR], '::: include signoff team="Acme"');
      expect(status).toBe(0);
      expect(stdout).toContain('The Acme Team');
    });

    it('accepts a single .md file, named by its basename', () => {
      const file = resolve(PARTIALS_DIR, 'blocks/legal.md');
      const { stdout, status } = run(['--partials', file], '::: include legal');
      expect(status).toBe(0);
      expect(stdout).toContain('https://example.com/unsub');
    });

    it('is repeatable and merges sources, later paths winning on collisions', () => {
      const override = resolve(__dirname, 'fixtures/partials-override/signoff.md');
      const { stdout, status } = run(
        ['-p', PARTIALS_DIR, '-p', override],
        '::: include signoff\n\n::: include blocks/legal',
      );
      expect(status).toBe(0);
      expect(stdout).toContain('The Override Team');
      expect(stdout).not.toContain('{{team}}');
      expect(stdout).toContain('https://example.com/unsub');
    });

    it('exits with code 1 if a path does not exist', () => {
      const { stderr, status } = run(['--partials', 'no-such-dir'], '# Hi');
      expect(status).toBe(1);
      expect(stderr).toContain('cannot read partials path');
    });
  });

  describe('error handling', () => {
    it('exits with code 1 if the file does not exist', () => {
      const { stderr, status } = run(['nonexistent.md']);
      expect(status).toBe(1);
      expect(stderr).toContain('cannot read file');
    });

    it('exits with code 1 if too many positional arguments', () => {
      const { stderr, status } = run(['a.md', 'b.md']);
      expect(status).toBe(1);
      expect(stderr).toContain('expected at most one positional argument');
    });

    it('exits with code 1 for an unknown option', () => {
      const { stderr, status } = run(['--unknown-flag']);
      expect(status).toBe(1);
      expect(stderr).toContain('emailmd:');
    });
  });
});
