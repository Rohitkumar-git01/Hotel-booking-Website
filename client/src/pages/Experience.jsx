import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Title from "../components/Title";
import spaImg from "../assets/spaExperience.png";
import diningImg from "../assets/fineDining.png";
import aboutLobbyImg from "../assets/aboutLobby.png";
import { assets } from "../assets/assets";

const experiences = [
  {
    id: 1,
    category: "Wellness & Spa",
    title: "Serenity Ocean Spa & Hydrotherapy",
    tagline: "Rejuvenate your body and mind with bespoke oceanfront treatments.",
    duration: "2 - 4 Hours",
    price: "$180 per person",
    rating: 4.9,
    reviews: 142,
    image: spaImg,
    highlights: [
      "Deep tissue mineral oil massage",
      "Private ocean-view hot spring tub",
      "Organic botanical aromatherapy",
      "Complimentary herbal tea lounge",
    ],
  },
  {
    id: 2,
    category: "Fine Dining",
    title: "Michelin-Star Rooftop Culinary Evening",
    tagline: "Savor exquisite gourmet multi-course tasting menus above the skyline.",
    duration: "3 Hours",
    price: "$250 per couple",
    rating: 5.0,
    reviews: 210,
    image: diningImg,
    highlights: [
      "7-course gourmet tasting menu",
      "Sommelier wine pairing selection",
      "Private candlelight rooftop seating",
      "Live acoustic jazz performance",
    ],
  },
  {
    id: 3,
    category: "Luxury Excursions",
    title: "Private Sunset Yacht & Champagne Cruise",
    tagline: "Sail into golden hour with private captain, oysters, and premium drinks.",
    duration: "Half Day (4 Hours)",
    price: "$550 per group",
    rating: 4.95,
    reviews: 98,
    image: aboutLobbyImg,
    highlights: [
      "Private 50ft luxury catamaran",
      "Unlimited vintage champagne & caviar",
      "Guided snorkeling & paddleboarding",
      "Dedicated onboard host & captain",
    ],
  },
];

const categories = ["All", "Wellness & Spa", "Fine Dining", "Luxury Excursions"];

const Experience = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredExperiences =
    activeCategory === "All"
      ? experiences
      : experiences.filter((exp) => exp.category === activeCategory);

  return (
    <div id="experience" className="pt-28 md:pt-35 pb-20 px-4 md:px-16 lg:px-24 xl:px-32 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <p className="text-orange-500 font-medium tracking-widest text-xs uppercase mb-2">
          Unforgettable Moments
        </p>
        <Title
          title="Curated Hotel Experiences"
          subTitle="Elevate your vacation beyond ordinary luxury with handpicked activities designed for memory making."
          align="center"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
        {categories.map((cat, idx) => (
          <button
            key={idx}
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer ${
              activeCategory === cat
                ? "bg-black text-white shadow-lg scale-105"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of Experiences */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredExperiences.map((exp) => (
          <div
            key={exp.id}
            className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 flex flex-col justify-between group border border-gray-100"
          >
            <div>
              {/* Image Container */}
              <div className="relative h-64 overflow-hidden">
                <img
                  src={exp.image}
                  alt={exp.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <span className="absolute top-4 left-4 bg-white/90 backdrop-blur-md text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow-md">
                  {exp.category}
                </span>
                <span className="absolute bottom-4 right-4 bg-black/75 text-white text-xs font-medium px-3 py-1 rounded-full backdrop-blur-sm">
                  ⏱️ {exp.duration}
                </span>
              </div>

              {/* Body */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1 text-sm font-medium text-amber-500">
                    ★ <span>{exp.rating}</span>
                    <span className="text-gray-400 text-xs">({exp.reviews} reviews)</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{exp.price}</span>
                </div>

                <h3 className="text-xl font-playfair font-bold text-gray-800 mb-2 group-hover:text-amber-700 transition-colors">
                  {exp.title}
                </h3>
                <p className="text-gray-500 text-sm mb-4">{exp.tagline}</p>

                {/* Highlights list */}
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  {exp.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer action */}
            <div className="p-6 pt-0">
              <button
                onClick={() => {
                  navigate("/rooms");
                  window.scrollTo(0, 0);
                }}
                className="w-full py-3 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-xl transition-all duration-300 shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Reserve Experience</span>
                <span>→</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Feature Highlights Strip */}
      <div className="mt-20 bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mb-4 shadow-sm">
            ✨
          </div>
          <h4 className="text-lg font-bold text-gray-800 font-playfair mb-1">
            Personalized Concierge
          </h4>
          <p className="text-gray-500 text-sm max-w-xs">
            Our experience hosts tailor every itinerary to your personal preferences.
          </p>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mb-4 shadow-sm">
            🛡️
          </div>
          <h4 className="text-lg font-bold text-gray-800 font-playfair mb-1">
            Guaranteed Quality
          </h4>
          <p className="text-gray-500 text-sm max-w-xs">
            Partnered exclusively with 5-star verified hospitality providers.
          </p>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-4 shadow-sm">
            💎
          </div>
          <h4 className="text-lg font-bold text-gray-800 font-playfair mb-1">
            VIP Priority Access
          </h4>
          <p className="text-gray-500 text-sm max-w-xs">
            Enjoy skip-the-line reservations, private seating, and exclusive perks.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Experience;
