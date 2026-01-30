import { parse } from 'graphql';
import { schema } from './shared/schema.js';
import { plugin } from '../src/index.js';

describe('TypeScript Operations Plugin - apolloUnmask', () => {
  it("'mask' with @unmask configured with apolloUnmask yields correct types", async () => {
    const ast = parse(/* GraphQL */ `
      query {
        me {
          ...UserFragment @unmask
        }
      }
      fragment UserFragment on User {
        id
      }
    `);
    const result = await plugin(
      schema,
      [{ location: 'test-file.ts', document: ast }],
      { inlineFragmentTypes: 'mask', customDirectives: { apolloUnmask: true } },
      { outputFile: '' }
    );

    expect(result.content).toMatchInlineSnapshot(`
      "export type Unnamed_1_QueryVariables = Exact<{ [key: string]: never; }>;


      export type Unnamed_1_Query = { __typename?: 'Query', me?: { __typename?: 'User', id: string } | null };

      export type UserFragmentFragment = { __typename?: 'User', id: string } & { ' $fragmentName'?: 'UserFragmentFragment' };
      "
    `);
  });

  it("'mask' with @unmask without apolloUnmask yields correct types", async () => {
    const ast = parse(/* GraphQL */ `
      query {
        me {
          ...UserFragment @unmask
        }
      }
      fragment UserFragment on User {
        id
      }
    `);
    const result = await plugin(
      schema,
      [{ location: 'test-file.ts', document: ast }],
      { inlineFragmentTypes: 'mask' },
      { outputFile: '' }
    );
    expect(result.content).toMatchInlineSnapshot(`
      "export type Unnamed_1_QueryVariables = Exact<{ [key: string]: never; }>;


      export type Unnamed_1_Query = { __typename?: 'Query', me?: (
          { __typename?: 'User' }
          & { ' $fragmentRefs'?: { 'UserFragmentFragment': UserFragmentFragment } }
        ) | null };

      export type UserFragmentFragment = { __typename?: 'User', id: string } & { ' $fragmentName'?: 'UserFragmentFragment' };
      "
    `);
  });

  it("'mask' with @unmask with apolloUnmask explicitly disabled yields correct types", async () => {
    const ast = parse(/* GraphQL */ `
      query {
        me {
          ...UserFragment @unmask
        }
      }
      fragment UserFragment on User {
        id
      }
    `);
    const result = await plugin(
      schema,
      [{ location: 'test-file.ts', document: ast }],
      { inlineFragmentTypes: 'mask', customDirectives: { apolloUnmask: false } },
      { outputFile: '' }
    );
    expect(result.content).toMatchInlineSnapshot(`
      "export type Unnamed_1_QueryVariables = Exact<{ [key: string]: never; }>;


      export type Unnamed_1_Query = { __typename?: 'Query', me?: (
          { __typename?: 'User' }
          & { ' $fragmentRefs'?: { 'UserFragmentFragment': UserFragmentFragment } }
        ) | null };

      export type UserFragmentFragment = { __typename?: 'User', id: string } & { ' $fragmentName'?: 'UserFragmentFragment' };
      "
    `);
  });

  it("'mask' with @unmask and masked fragments yields correct types", async () => {
    const ast = parse(/* GraphQL */ `
      query {
        me {
          ...UserFragment @unmask
          ...UserFragment2
        }
      }
      fragment UserFragment on User {
        id
      }

      fragment UserFragment2 on User {
        email
      }
    `);
    const result = await plugin(
      schema,
      [{ location: 'test-file.ts', document: ast }],
      { inlineFragmentTypes: 'mask', customDirectives: { apolloUnmask: true } },
      { outputFile: '' }
    );
    expect(result.content).toMatchInlineSnapshot(`
      "export type Unnamed_1_QueryVariables = Exact<{ [key: string]: never; }>;


      export type Unnamed_1_Query = { __typename?: 'Query', me?: (
          { __typename?: 'User', id: string }
          & { ' $fragmentRefs'?: { 'UserFragment2Fragment': UserFragment2Fragment } }
        ) | null };

      export type UserFragmentFragment = { __typename?: 'User', id: string } & { ' $fragmentName'?: 'UserFragmentFragment' };

      export type UserFragment2Fragment = { __typename?: 'User', email: string } & { ' $fragmentName'?: 'UserFragment2Fragment' };
      "
    `);
  });

  it("'mask' with @unmask and masked fragments on overlapping fields yields correct types", async () => {
    const ast = parse(/* GraphQL */ `
      query {
        me {
          ...UserFragment @unmask
          ...UserFragment2
        }
      }
      fragment UserFragment on User {
        id
        email
      }

      fragment UserFragment2 on User {
        email
      }
    `);
    const result = await plugin(
      schema,
      [{ location: 'test-file.ts', document: ast }],
      { inlineFragmentTypes: 'mask', customDirectives: { apolloUnmask: true } },
      { outputFile: '' }
    );
    expect(result.content).toMatchInlineSnapshot(`
      "export type Unnamed_1_QueryVariables = Exact<{ [key: string]: never; }>;


      export type Unnamed_1_Query = { __typename?: 'Query', me?: (
          { __typename?: 'User', id: string, email: string }
          & { ' $fragmentRefs'?: { 'UserFragment2Fragment': UserFragment2Fragment } }
        ) | null };

      export type UserFragmentFragment = { __typename?: 'User', id: string, email: string } & { ' $fragmentName'?: 'UserFragmentFragment' };

      export type UserFragment2Fragment = { __typename?: 'User', email: string } & { ' $fragmentName'?: 'UserFragment2Fragment' };
      "
    `);
  });

  it('parent fragment spreading child fragment with @unmask should be type-compatible', async () => {
    // When a parent fragment spreads a child fragment with @unmask,
    // the parent should be assignable to the child fragment type
    const ast = parse(/* GraphQL */ `
      fragment ChildFragment on User {
        id
        username
      }

      fragment ParentFragment on User {
        ...ChildFragment @unmask
        email
      }
    `);
    const result = await plugin(
      schema,
      [{ location: 'test-file.ts', document: ast }],
      { inlineFragmentTypes: 'mask', customDirectives: { apolloUnmask: true } },
      { outputFile: '' }
    );

    // ParentFragmentFragment's $fragmentName contains only ChildFragmentFragment
    // This allows ParentFragmentFragment to be passed as ChildFragmentFragment
    expect(result.content).toMatchInlineSnapshot(`
      "export type ChildFragmentFragment = { __typename?: 'User', id: string, username: string } & { ' $fragmentName'?: 'ChildFragmentFragment' };

      export type ParentFragmentFragment = { __typename?: 'User', email: string, id: string, username: string } & { ' $fragmentName'?: 'ChildFragmentFragment' };
      "
    `);
  });

  it('nested @unmask fragments should propagate $fragmentName correctly', async () => {
    // 3-level fragments: Grandchild -> Child -> Parent
    const ast = parse(/* GraphQL */ `
      fragment GrandchildFragment on User {
        id
      }

      fragment ChildFragment on User {
        ...GrandchildFragment @unmask
        username
      }

      fragment ParentFragment on User {
        ...ChildFragment @unmask
        email
      }
    `);
    const result = await plugin(
      schema,
      [{ location: 'test-file.ts', document: ast }],
      { inlineFragmentTypes: 'mask', customDirectives: { apolloUnmask: true } },
      { outputFile: '' }
    );

    // ParentFragment and ChildFragment inherit the deepest GrandchildFragment's $fragmentName
    // This ensures all fragments are type-compatible with each other
    expect(result.content).toMatchInlineSnapshot(`
      "export type GrandchildFragmentFragment = { __typename?: 'User', id: string } & { ' $fragmentName'?: 'GrandchildFragmentFragment' };

      export type ChildFragmentFragment = { __typename?: 'User', username: string, id: string } & { ' $fragmentName'?: 'GrandchildFragmentFragment' };

      export type ParentFragmentFragment = { __typename?: 'User', email: string, username: string, id: string } & { ' $fragmentName'?: 'GrandchildFragmentFragment' };
      "
    `);
  });

  it('multiple @unmask spreads should collect all child $fragmentNames', async () => {
    // When a parent spreads multiple children with @unmask,
    // the parent's $fragmentName should include all children's names
    const ast = parse(/* GraphQL */ `
      fragment Child1Fragment on User {
        id
      }

      fragment Child2Fragment on User {
        username
      }

      fragment ParentFragment on User {
        ...Child1Fragment @unmask
        ...Child2Fragment @unmask
        email
      }
    `);
    const result = await plugin(
      schema,
      [{ location: 'test-file.ts', document: ast }],
      { inlineFragmentTypes: 'mask', customDirectives: { apolloUnmask: true } },
      { outputFile: '' }
    );

    // ParentFragment's $fragmentName contains both Child1 and Child2
    expect(result.content).toMatchInlineSnapshot(`
      "export type Child1FragmentFragment = { __typename?: 'User', id: string } & { ' $fragmentName'?: 'Child1FragmentFragment' };

      export type Child2FragmentFragment = { __typename?: 'User', username: string } & { ' $fragmentName'?: 'Child2FragmentFragment' };

      export type ParentFragmentFragment = { __typename?: 'User', email: string, id: string, username: string } & { ' $fragmentName'?: 'Child1FragmentFragment' | 'Child2FragmentFragment' };
      "
    `);
  });

  it('mixed @unmask and masked spreads should only inherit from @unmask children', async () => {
    // When a parent has both @unmask and masked spreads,
    // only the @unmask children's $fragmentName should be inherited
    const ast = parse(/* GraphQL */ `
      fragment Child1Fragment on User {
        id
      }

      fragment Child2Fragment on User {
        username
      }

      fragment ParentFragment on User {
        ...Child1Fragment @unmask
        ...Child2Fragment
        email
      }
    `);
    const result = await plugin(
      schema,
      [{ location: 'test-file.ts', document: ast }],
      { inlineFragmentTypes: 'mask', customDirectives: { apolloUnmask: true } },
      { outputFile: '' }
    );

    // ParentFragment's $fragmentName contains only Child1 (the @unmask one)
    // Child2 is masked, so it appears in $fragmentRefs instead
    expect(result.content).toMatchInlineSnapshot(`
      "export type Child1FragmentFragment = { __typename?: 'User', id: string } & { ' $fragmentName'?: 'Child1FragmentFragment' };

      export type Child2FragmentFragment = { __typename?: 'User', username: string } & { ' $fragmentName'?: 'Child2FragmentFragment' };

      export type ParentFragmentFragment = (
        { __typename?: 'User', email: string, id: string }
        & { ' $fragmentRefs'?: { 'Child2FragmentFragment': Child2FragmentFragment } }
      ) & { ' $fragmentName'?: 'Child1FragmentFragment' };
      "
    `);
  });
});
