import { Form, useLoaderData, useActionData } from 'react-router-dom'
import { query } from '../../dist/index.js'

export async function loader() {
  return { message: 'Ask Claude something' }
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData()
  const prompt = formData.get('prompt') as string
  const messages = []
  for await (const msg of query(prompt)) {
    messages.push(msg)
  }
  return { messages }
}

export default function Index() {
  const data = useLoaderData() as { message: string }
  const actionData = useActionData() as { messages?: any[] }
  return (
    <div>
      <p>{data.message}</p>
      <Form method="post">
        <input type="text" name="prompt" />
        <button type="submit">Send</button>
      </Form>
      <pre>{JSON.stringify(actionData?.messages, null, 2)}</pre>
    </div>
  )
}

export function ErrorBoundary({ error }: { error: Error }) {
  return <div>Error: {error.message}</div>
}
