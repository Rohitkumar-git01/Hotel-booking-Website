import React from "react";
import { useNavigate } from "react-router-dom";
import Title from "../components/Title";
import aboutLobbyImg from "../assets/aboutLobby.png";
import spaImg from "../assets/spaExperience.png";

const stats = [
  { label: "Luxury Hotels & Resorts", value: "500+" },
  { label: "Satisfied Global Guests", value: "85,000+" },
  { label: "Featured Cities Worldwide", value: "40+" },
  { label: "Guest Satisfaction Rating", value: "4.95 / 5" },
];

const values = [
  {
    icon: "💎",
    title: "Uncompromising Luxury",
    description: "Every hotel in our luxury network is hand-inspected to exceed the highest international hospitality standards.",
  },
  {
    icon: "🤝",
    title: "Seamless Booking Experience",
    description: "Instant reservations, flexible payment options, and transparent pricing with no hidden surprise fees.",
  },
  {
    icon: "🛡️",
    title: "24/7 Dedicated Support",
    description: "Our round-the-clock concierge team ensures your trip goes flawlessly from check-in to check-out.",
  },
  {
    icon: "🌿",
    title: "Sustainable Hospitality",
    description: "Promoting eco-luxury resorts committed to environmental conservation and supporting local communities.",
  },
];

const About = () => {
  const navigate = useNavigate();

  return (
    <div id="about" className="pt-28 md:pt-35 pb-20 px-4 md:px-16 lg:px-24 xl:px-32 bg-white min-h-screen">
      {/* Hero / Overview Section */}
      <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16 mb-20">
        <div className="lg:w-1/2 flex flex-col items-start text-left">
          <p className="text-orange-500 font-medium tracking-widest text-xs uppercase mb-2">
            About QuickStay
          </p>
          <h1 className="font-playfair text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Redefining Luxury & Comfort in Every Stay
          </h1>
          <p className="text-gray-600 text-base md:text-lg leading-relaxed mb-6">
            Founded with a vision to connect travelers with extraordinary hospitality, QuickStay curates top-tier hotels, luxury boutique suites, and scenic resorts around the world.
          </p>
          <p className="text-gray-500 text-sm md:text-base leading-relaxed mb-8">
            Whether you are planning a tranquil wellness getaway, a corporate retreat, or a high-end honeymoon, our platform offers curated choices, instant booking confidence, and personalized guest services.
          </p>

          <button
            onClick={() => {
              navigate("/rooms");
              window.scrollTo(0, 0);
            }}
            className="px-8 py-4 bg-black text-white text-sm font-medium rounded-full shadow-lg hover:bg-gray-800 transition-all duration-300 cursor-pointer"
          >
            Explore Hotels
          </button>
        </div>

        {/* Image showcase stack */}
        <div className="lg:w-1/2 relative w-full">
          <img
            src={aboutLobbyImg}
            alt="Luxury Hotel Lobby"
            loading="lazy"
            decoding="async"
            className="w-full h-auto rounded-3xl shadow-2xl object-cover"
          />
          <div className="absolute -bottom-6 -left-6 max-w-xs bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-xl border border-gray-100 hidden sm:flex items-center gap-4">
            <img
              src={spaImg}
              alt="Spa experience"
              loading="lazy"
              decoding="async"
              className="w-16 h-16 rounded-xl object-cover"
            />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                Award Winner
              </p>
              <p className="text-sm font-bold text-gray-800 font-playfair">
                World's Best Hotel Portal 2026
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Counter Section */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-14 my-20 shadow-2xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <span className="font-playfair text-3xl md:text-5xl font-extrabold text-amber-400 mb-2">
                {stat.value}
              </span>
              <span className="text-gray-300 text-xs md:text-sm max-w-xs font-light">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Core Values Section */}
      <div className="my-20">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-orange-500 font-medium tracking-widest text-xs uppercase mb-2">
            Why Choose Us
          </p>
          <Title
            title="Our Core Values"
            subTitle="We built QuickStay around transparency, luxury, and relentless devotion to unforgettable guest satisfaction."
            align="center"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {values.map((val, idx) => (
            <div
              key={idx}
              className="bg-slate-50 rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-all duration-300 flex flex-col items-start hover:-translate-y-1"
            >
              <div className="text-4xl mb-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                {val.icon}
              </div>
              <h3 className="font-playfair text-xl font-bold text-gray-800 mb-2">
                {val.title}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {val.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Founder / Brand Statement */}
      <div className="bg-amber-50/60 rounded-3xl p-8 md:p-12 border border-amber-100 flex flex-col md:flex-row items-center justify-between gap-8 my-16">
        <div className="max-w-2xl">
          <h3 className="font-playfair text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Interested in Partnering as a Hotel Owner?
          </h3>
          <p className="text-gray-600 text-sm md:text-base">
            List your luxury property on QuickStay to reach thousands of high-value travelers globally. Access our host dashboard and management suite seamlessly.
          </p>
        </div>
        <button
          onClick={() => {
            navigate("/rooms");
            window.scrollTo(0, 0);
          }}
          className="px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm rounded-full transition-all shadow-md cursor-pointer whitespace-nowrap"
        >
          Become a Partner
        </button>
      </div>
    </div>
  );
};

export default About;
