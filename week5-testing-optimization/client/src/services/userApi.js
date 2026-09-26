/**
 * User-profile service
 * --------------------
 * Fetches a demo user from DummyJSON (https://dummyjson.com) – a free public
 * REST API – to simulate an authenticated user's profile on the dashboard.
 */

const BASE_URL = 'https://dummyjson.com'

/**
 * @param {number} id  user id (DummyJSON has 1-208)
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ id:number, firstName:string, lastName:string, email:string, image:string, company:{title:string} }>}
 */
export async function fetchUserProfile(id = 1, signal) {
  const res = await fetch(`${BASE_URL}/users/${id}?select=firstName,lastName,email,image,company`, { signal })
  if (!res.ok) throw new Error(`User API responded with ${res.status}`)
  return res.json()
}
