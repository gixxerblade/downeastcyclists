# Migrating Bylaws to Contentful

This guide outlines the steps to migrate the bylaws data from the codebase to Contentful.

## 1. Create a Content Type in Contentful

1. Log in to your Contentful account and navigate to your space.
2. Go to "Content model" and click "Add content type".
3. Name the content type "Bylaw" and give it a description like "Club bylaws articles".
4. Add the following fields:

   | Field Name | Field Type | Required | Settings                                                                 |
   | ---------- | ---------- | -------- | ------------------------------------------------------------------------ |
   | id         | Short text | Yes      | This will store the section ID (e.g., "Section 1")                       |
   | title      | Short text | Yes      | This will store the article title (e.g., "Article I. Organization Name") |
   | body       | Rich Text  | Yes      | This will store the article content                                      |
   | order      | Integer    | Yes      | This will determine the display order of the articles                    |

5. Save the content type.

## 2. Create Entries for Each Bylaw Article

For each article in the bylaws, create a new entry in Contentful:

1. Go to "Content" and click "Add entry".
2. Select the "Bylaw" content type.
3. Fill in the fields:
   - **id**: Use the section ID (e.g., "Section 1")
   - **title**: Use the article title (e.g., "Article I. Organization Name")
   - **body**: Copy the content from the existing bylaws data and format it using the Rich Text editor
   - **order**: Set the display order (1 for the first article, 2 for the second, etc.)
4. Publish the entry.

## 3. Example Data Migration

Here's an example of how to migrate the first bylaw article:

### In Code (Current)

```javascript
{
  title: () => <>Article I. Organization Name</>,
  body: () => (
    <p>The name of the organization shall be the Down East Cyclist (DEC).</p>
  ),
  id: "Section 1",
}
```

### In Contentful (New)

- **id**: "Section 1"
- **title**: "Article I. Organization Name"
- **body**: "The name of the organization shall be the Down East Cyclist (DEC)."
- **order**: 1

## 4. Testing the Migration

After migrating all the bylaws data to Contentful:

1. Run the development server: `yarn dev`
2. Navigate to the bylaws page: `http://localhost:3000/about/bylaws`
3. Verify that all the bylaws articles are displayed correctly.

## 5. Deployment Considerations

The bylaws page is configured to use static generation (`export const dynamic = 'force-static'`), which means:

- The page will be generated at build time
- Content changes in Contentful will only be reflected after a new build and deployment
- This approach is appropriate for bylaws since they rarely change

If you need to update the bylaws:

1. Make the changes in Contentful
2. Trigger a new build and deployment of the website

## 6. Troubleshooting

If the bylaws don't appear:

1. Check the Contentful API keys in your environment variables.
2. Verify that the content type and field names match those in the code.
3. Make sure all entries are published in Contentful.
4. Check the browser console for any errors.

## 7. Benefits of Using Contentful

- **Content Management**: Non-technical users can update the bylaws without code changes.
- **Versioning**: Contentful tracks changes to content, making it easy to revert if needed.
- **Separation of Concerns**: Content is separated from presentation, making the codebase cleaner.
- **Rich Text Formatting**: Contentful's Rich Text editor allows for more complex formatting than hardcoded JSX.
