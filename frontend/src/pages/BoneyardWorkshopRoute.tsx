import { useLoaderData } from 'react-router-dom'

import Boneyard from './Boneyard.tsx'
import { boneyardLibraryReturnUrl, type loadWorkshopRequest } from '../editor/workshop-navigation.ts'

export default function BoneyardWorkshopRoute() {
  const launch = useLoaderData<typeof loadWorkshopRequest>()
  const returnToLibrary = () => window.location.assign(boneyardLibraryReturnUrl())
  if (launch.error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <p role="alert">{launch.error}</p>
        <button className="btn btn-stone" onClick={returnToLibrary} type="button">← The Dark Cloud</button>
      </main>
    )
  }
  return <Boneyard onBack={launch.request ? returnToLibrary : undefined} request={launch.request ?? undefined} />
}
