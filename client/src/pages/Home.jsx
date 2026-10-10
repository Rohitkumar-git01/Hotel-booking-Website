import React from 'react';
import ExclusiveOffer from '../components/ExclusiveOffer';
import FeatureDestination from '../components/FeatureDestination';
import Hero from '../components/Hero';
import NewsLetter from '../components/NewsLetter';
import Testimonial from '../components/Testimonial';
import Experience from './Experience';
import About from './About';

const Home = () => {
  return (
    <>
      <Hero />
      <FeatureDestination />
      <Experience />
      <ExclusiveOffer />
      <About />
      <Testimonial />
      <NewsLetter />
    </>
  );
};

export default Home;