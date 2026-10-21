import { Redirect } from 'expo-router';

/** The app always opens on Sell › All products, so people at the table never see the sales on Home. */
export default function Index() {
  return <Redirect href="/sell" />;
}
