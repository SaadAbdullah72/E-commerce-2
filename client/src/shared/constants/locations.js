/**
 * Where the shop delivers. Used by the Shipping page and by the default address on the Profile
 * page, so both offer exactly the same choices.
 *
 * TODO(market): placeholder Nigerian list until the market is confirmed (see market.js).
 */
export const STATES = [
  'Abia State',
  'Adamawa State',
  'Akwa Ibom State',
  'Anambra State',
  'Bauchi State (Primary Local Hub)',
  'Bayelsa State',
  'Benue State',
  'Borno State',
  'Cross River State',
  'Delta State',
  'Ebonyi State',
  'Edo State',
  'Ekiti State',
  'Enugu State',
  'Federal Capital Territory (FCT / Abuja)',
  'Gombe State',
  'Imo State',
  'Jigawa State',
  'Kaduna State',
  'Kano State',
  'Katsina State',
  'Kebbi State',
  'Kogi State',
  'Kwara State',
  'Lagos State',
  'Nasarawa State',
  'Niger State',
  'Ogun State',
  'Ondo State',
  'Osun State',
  'Oyo State',
  'Plateau State',
  'Rivers State',
  'Sokoto State',
  'Taraba State',
  'Yobe State',
  'Zamfara State',
];

/** The local hub: free delivery and its own courier. */
export const BAUCHI_STATE = 'Bauchi State (Primary Local Hub)';

export const BAUCHI_EXCLUSIVE_COURIER =
  'ShopYaro Express Delivery (Bauchi Local Only) (Same Day / 24 Hours (Bauchi State Only))';

const BAUCHI_CITIES = [
  'Bauchi (Metropolis)',
  'Azare',
  'Misau',
  "Jama'are",
  'Katagum',
  'Ningi',
  'Dass',
  'Toro',
  'Alkaleri',
  'Bogoro',
  'Tafawa Balewa',
  'Darazo',
  'Gamawa',
  'Giade',
  'Itas/Gadau',
  'Shira',
  'Warji',
  'Zaki',
  'Kirfi',
  'Damban',
];

const STANDARD_CITIES = [
  'City Central / Metropolis',
  'Capital District',
  'Commercial Area',
  'Outer Region',
];

/**
 * The cities offered for a state. Empty until a valid state is chosen.
 * @param {string | null | undefined} state
 * @returns {string[]}
 */
export function citiesForState(state) {
  if (!STATES.includes(state)) return [];
  return state === BAUCHI_STATE ? BAUCHI_CITIES : STANDARD_CITIES;
}
