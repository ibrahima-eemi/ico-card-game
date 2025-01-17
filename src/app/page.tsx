"use client";

import React, { useState } from "react";
import { useGame } from "@/context/GameContext";
import { useRouter } from "next/navigation"; // Assurez-vous que vous utilisez le bon import

const Home: React.FC = () => {
  const [roomCode, setRoomCode] = useState<string>(""); // Code de la salle
  const { dispatch } = useGame(); // Context du jeu
  const router = useRouter(); // Navigation

  // Créer une nouvelle partie
  const handleCreateGame = () => {
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase(); // Code aléatoire
    dispatch({ type: "UPDATE_STATUS", payload: "active" }); // Met à jour le statut
    router.push(`game/rooms/${newRoomCode}`); // Redirection vers la nouvelle salle
  };

  // Rejoindre une partie existante
  const handleJoinGame = () => {
    if (!roomCode.trim()) {
      alert("Veuillez entrer un code de salle !");
      return;
    }
    router.push(`game/rooms/${roomCode.trim().toUpperCase()}`); // Redirection vers la salle existante
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-lg shadow-md p-5">
      <h2 className="text-2xl font-semibold mb-4">
        Bon retour, <span className="text-purple-600">James</span> !
      </h2>
      
      {/* Boutons de jeu */}

        {/* Champ d'entrée pour entrer un code */}
        <input 
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          placeholder="Code de la salle"
          className="w-full p-2 border border-gray-300 rounded-md mt-2"
        />
        
      <div className="space-y-4">
        <button 
          className="w-full bg-purple-500 text-white py-3 rounded-lg text-left px-4"
          onClick={handleCreateGame} // Lien avec la fonction de création
        >
          <span className="font-bold">Démarrer une partie</span>
          <p className="text-sm">Lancez une nouvelle aventure et défiez vos amis</p>
        </button>

        <button 
          className="w-full bg-purple-900 text-white py-3 rounded-lg text-left px-4"
          onClick={handleJoinGame} // Lien avec la fonction de connexion
        >
          <span className="font-bold">Rejoindre une partie</span>
          <p className="text-sm">Entrez dans une partie existante et rejoignez l&apos;aventure</p>
        </button>
      </div>
      
      {/* Statistiques */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold">Mes statistiques</h3>
        <div className="flex justify-center mt-3">
          <div className="flex space-x-4 overflow-x-scroll md:overflow-x-auto md:justify-center pb-4 max-w-screen-lg">
            <div className="flex-shrink-0 w-60 p-4 bg-gray-100 shadow rounded-md text-center">
              <p className="text-xl font-bold">25</p>
              <p className="text-sm">Parties jouées</p>
            </div>
            <div className="flex-shrink-0 w-60 p-4 bg-gray-100 shadow rounded-md text-center">
              <p className="text-xl font-bold">17</p>
              <p className="text-sm">Victoires</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cartes Bonus */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold">Cartes Bonus disponibles</h3>
        <div className="flex justify-center mt-3">
          <div className="flex space-x-4 overflow-x-scroll md:overflow-x-auto md:justify-center pb-4 max-w-screen-lg">
            {[
              "Voyage_express", "Antidote", "Charlatan", "Mal_de_mer", "Malandrin", 
              "Medusa", "Mer_agite", "Observateur", "Perroquet", "Troc"
            ].map((card) => (
              <div key={card} className="flex-shrink-0 w-40 p-4 bg-gray-100 shadow rounded-md text-center">
                <img src={`/cartes/bonus/Carte-${card}.png`} alt={card} className="w-full h-32 object-contain mb-2" />
                <h4 className="font-bold">{card.replace(/_/g, ' ')}</h4>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Règles du jeu */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold">Règles du jeu</h3>
        <p className="text-sm mt-2">
          ICO est un jeu de société numérique où pirates, marins et sirènes s&apos;affrontent pour le contrôle d’un trésor en mer.
        </p>
        <button className="w-full bg-purple-500 text-white py-2 rounded-lg mt-4">En savoir plus</button>
      </div>
    </div>
  );
};

export default Home;
