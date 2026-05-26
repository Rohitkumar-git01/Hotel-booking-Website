import ExclusiveOffer from '../components/ExclusiveOffer';
import FeatureDestination from '../components/FeatureDestination'
import Hero from '../components/Hero'
import NewsLetter from '../components/NewsLetter';
import Testimonial from '../components/Testimonial';

const Home = () => {
  return (
    <>
        <Hero />
        <FeatureDestination />
        <ExclusiveOffer />
        <Testimonial />
        <NewsLetter/>
    </>
  )
}

export default Home;