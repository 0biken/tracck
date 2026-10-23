import { redirect } from 'next/navigation'

// Access requests live at /consent/<token>. Without one there is nothing to answer.
export default function ConsentIndex() {
  redirect('/')
}
