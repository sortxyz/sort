export function toSlugString(str: string) {
  return (
    str
      // make the url lowercase
      .toLowerCase()
      // replace & with and
      .split(/&+/)
      .join("-and-")
      // remove invalid characters
      .split(/[^a-z0-9]/)
      .join("-")
      // remove duplicates
      .split(/-+/)
      .join("-")
      // trim leading & trailing characters
      .trim()
  );
}

// TODO: share this with the API once we migrate to monorepo
// https://github.com/orgs/sortxyz/projects/2/views/8?pane=issue&itemId=42921927
export const DEFAULT_ORG_DESCRIPTION = `## Public Organization Summary 🔥

This is the **public** summary of your Sort organization. Everything you write
here is _visible_ to the internet. You can use this space to share information
about your organization, such as:

- The purpose of your organization
- The types of data you collect & share
- Links to your organization's website or social media
- Contact information for your organization
- Instructions for using your organization's data
- Use [markdown](https://commonmark.org/help/) to create any fun stuff you want! 🎉

### Next Steps

1. Add your databases: Settings -> Connections -> New
2. Invite your team: People -> Invites -> New
3. Make your data public: Settings -> Connections -> Settings -> Visibility`;
