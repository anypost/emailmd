import type { MDXComponents } from 'mdx/types';
import defaultMDXComponents from 'fumadocs-ui/mdx';
import { McpInstallButtons } from '@/components/mcp-install';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMDXComponents,
    McpInstallButtons,
    ...components,
  };
}
