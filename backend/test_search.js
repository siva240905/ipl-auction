import { searchImages } from 'duck-duck-scrape';

async function test() {
  try {
    const results = await searchImages('Virat Kohli cricket player');
    console.log(JSON.stringify(results.results[0], null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
