const { WebSocketServer, WebSocket } = require("ws");
const crypto = require("crypto");

const port = 5000;
const wss = new WebSocketServer({ port });
const rooms = {}; // Stockage des rooms et des joueurs

console.log(`🚀 WebSocketServer démarré sur ws://localhost:${port}`);

wss.on("connection", (ws) => {
  console.log("🟢 Client connecté");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("📩 Message reçu du client :", data);
  
      let { type, roomCode, username, avatar, createNewRoom, selectedCrew } = data;
  
      if (!username) {
        console.error("❌ Erreur : username est undefined !");
        return;
      }
  
      if (!avatar) {
        console.warn("⚠️ Aucun avatar fourni, génération automatique...");
        avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;
      }
  
      // Gestion de la connexion à une salle
      if (type === "JOIN_ROOM") {
        if (roomCode) {
          console.log(`🔗 Code de salle reçu de l'URL : ${roomCode}`);
          if (!rooms[roomCode]) {
            console.log(`📌 Création de la salle ${roomCode}...`);
            rooms[roomCode] = {
              players: [],
              currentCaptainIndex: 0,
              failedVotes: 0,
              currentRound: 1,           // Numéro du tour en cours
              maxRounds: 10,             // Nombre maximum de tours
              usedCaptains: [] // Compteur pour les votes échoués
            };
          }
        } else if (createNewRoom) {
          roomCode = generateRoomCode();
          console.log(`🆕 Nouvelle salle forcée : ${roomCode}`);
          rooms[roomCode] = {
            players: [],
            currentCaptainIndex: 0,
            failedVotes: 0, // Compteur pour les votes échoués
          };
        } else {
          roomCode = findExistingRoom() || generateRoomCode();
          console.log(`🔄 Salle trouvée/attribuée à ${username} : ${roomCode}`);
          if (!rooms[roomCode]) {
            rooms[roomCode] = {
              players: [],
              currentCaptainIndex: 0,
              failedVotes: 0, // Compteur pour les votes échoués
            };
          }
        }
      
        if (!rooms[roomCode]) {
          console.error(`❌ Erreur : La salle ${roomCode} n'a pas pu être créée.`);
          return;
        }
      
        const playerIndex = rooms[roomCode].players.findIndex((p) => p.username === username);
      
        if (playerIndex === -1) {
          rooms[roomCode].players.push({
            id: crypto.randomUUID(),
            username,
            avatar,
            role: null, // Pas encore attribué
            isCaptain: false,
            roomCode,
            piratePoints: 0,
            marinPoints: 0,
            mancheGagnees: 0,
            ws,
            roleConfirmed: false, // Indique si le joueur a confirmé son rôle
          });
        } else {
          console.log(`⚠️ ${username} est déjà dans la salle ${roomCode}`);
        }
      
        console.log(`👥 ${username} a rejoint la salle ${roomCode}`);
        
        const playersList = rooms[roomCode].players.map((player) => ({
          username: player.username,
          avatar: player.avatar,
          isCaptain: player.isCaptain,
          isCrewMember: player.isCrewMember, // on ajoute
          role: player.role,                 // si utile pour le front
          piratePoints: player.piratePoints, // etc.
          marinPoints: player.marinPoints,
        }));
        broadcast(roomCode, { type: "ROOM_UPDATE", players: playersList });
      }
      
  
      // Début de la partie
      if (type === "GAME_START" && roomCode) {
        console.log(`🎮 La partie dans la salle ${roomCode} commence !`);
      
        const room = rooms[roomCode];
        if (!room || room.players.length === 0) {
          console.error(`❌ Impossible de démarrer la partie : la salle ${roomCode} est vide.`);
          return;
        }
      
        // Utilisez room.players au lieu de rooms[roomCode]
        const playersList = room.players.map(({ username, avatar }) => ({
          username,
          avatar,
        }));
        
        broadcast(roomCode, { type: "GAME_START", players: playersList });
      
        console.log(`🚀 Partie démarrée pour la salle ${roomCode} avec les joueurs :`, playersList);
        assignRoles(roomCode); // Appeler la fonction pour assigner les rôles
      }
      
  
      // Confirmation du rôle par le joueur
      if (type === "ROLE_CONFIRMED" && roomCode) {
        const room = rooms[roomCode];
        if (!room) {
          console.error(`❌ Salle introuvable : ${roomCode}`);
          return;
        }
      
        // Utiliser room.players pour accéder à la liste des joueurs
        const player = room.players.find((p) => p.username === username);
        if (!player) {
          console.error(`❌ Joueur introuvable dans la salle ${roomCode} : ${username}`);
          return;
        }
      
        player.roleConfirmed = true;
        console.log(`✅ ${username} a confirmé son rôle dans la salle ${roomCode}`);
      
        // Vérifie si tous les joueurs ont confirmé leur rôle
        const allConfirmed = room.players.every((p) => p.roleConfirmed);
        if (allConfirmed) {
          console.log(`🎉 Tous les joueurs ont confirmé leurs rôles dans la salle ${roomCode}`);
          assignCaptain(roomCode); // Nouveau : Passe au choix du capitaine
        }
      }
      
  
      // Gestion du capitaine sélectionné
      if (type === "CAPTAIN_ACTION_CONFIRMED" && roomCode) {
        console.log(`✅ Le capitaine a confirmé son action pour la salle ${roomCode}`);
      
        const room = rooms[roomCode];
        if (!room) {
          console.error(`❌ Salle introuvable : ${roomCode}`);
          return;
        }
      
        const captain = room.players.find((p) => p.username === username);
        if (!captain) {
          console.error(`❌ Capitaine introuvable : ${username}`);
          return;
        }
      
        broadcast(roomCode, { type: "CREW_SELECTION_PHASE", captain: captain.username, avatar :captain.avatar });
        console.log(`📤 Phase de sélection d'équipage commencée pour la salle ${roomCode}`);
      }
      
  
      // Gestion de la sélection de l'équipage
      console.log("📩 Roomcode :", roomCode);
      console.log("📩 Type :", type);
  
      if (type === "CREW_SELECTED") {
        console.log(`📤 Équipage sélectionné pour la salle ${roomCode}:`, selectedCrew);
    
        if (!rooms[roomCode]) {
            console.error(`❌ Salle introuvable : ${roomCode}`);
            return;
        }
    
        const room = rooms[roomCode];
        const playersInRoom = room.players;
    
        if (!playersInRoom) {
            console.error(`❌ Aucun joueur trouvé dans la salle ${roomCode}`);
            return;
        }
    
        // Mise à jour des membres sélectionnés
        room.selectedCrew = selectedCrew;
    
        // Si nécessaire, vérifie si les `selectedCrew` sont bien des joueurs existants
        const validCrew = selectedCrew.filter((crewMember) =>
            playersInRoom.some((p) => p.username === crewMember)
        );
    
        if (validCrew.length !== selectedCrew.length) {
            console.error("❌ Des membres sélectionnés ne sont pas valides :", selectedCrew);
            return;
        }
        room.players.forEach((p) => {
          p.isCrewMember = selectedCrew.includes(p.username);
        });
        console.log(`✅ Équipage valide sélectionné :`, validCrew);
        room.crewActionsCount = 0; // Réinitialiser le compteur d'actions d'équipage
        // Broadcast pour informer les autres joueurs
        broadcast(roomCode, { type: "CREW_SELECTED", selectedCrew: validCrew });
        // Rediffuser une liste complète des joueurs
        const playersList = room.players.map((pl) => ({
            username: pl.username,
            avatar: pl.avatar,
            isCrewMember: pl.isCrewMember,
            role: pl.role,
            piratePoints: pl.piratePoints,
            marinPoints: pl.marinPoints,
           }));
         broadcast(roomCode, { type: "ROOM_UPDATE", players: playersList });
    
       
    }
    
  
      // Gestion du vote d'équipage
  // Gestion du vote d'équipage
if (type === "VOTE_CREW" && roomCode) {
  console.log(`📩 [VOTE_CREW] Reçu pour la salle ${roomCode} de la part de ${username}`);

  const room = rooms[roomCode];
  if (!room) {
    console.error(`❌ [VOTE_CREW] Salle introuvable : ${roomCode}`);
    return;
  }

  const player = room.players.find((p) => p.username === username);
  if (!player) {
    console.error(`❌ [VOTE_CREW] Joueur introuvable dans la salle ${roomCode} : ${username}`);
    return;
  }

  // Ajout du vote de l'utilisateur
  player.vote = data.vote; // "yes" ou "no"
  console.log(`🗳️ [VOTE_CREW] Vote reçu : ${username} a voté "${data.vote}" dans la salle ${roomCode}`);

  // Vérifie si tous les joueurs non membres de l'équipage ont voté
  const totalPlayers = room.players.length; // Nombre total de joueurs dans la salle
  const totalVotesNeeded = totalPlayers - 4; // Nombre de votes nécessaires (total - 4 joueurs de l'équipage et capitaine)
  const votesReceived = room.players.filter((p) => p.vote !== undefined).length; // Nombre de votes reçus

  console.log(totalVotesNeeded);
  console.log(votesReceived);



  if (votesReceived === totalVotesNeeded) {
    console.log(`✅ [VOTE_CREW] Tous les votes nécessaires ont été reçus dans la salle ${roomCode}`);
  
    // Compte des votes
    const votesYes = room.players.filter((p) => p.vote === "yes").length;
    const votesNo = room.players.filter((p) => p.vote === "no").length;
  
    console.log(`📊 [VOTE_CREW] Résultats des votes : Oui = ${votesYes}, Non = ${votesNo}`);
  
    const approved = votesYes > votesNo;
  
    // Diffuser les résultats à tous les joueurs
    broadcast(roomCode, {
      type: "VOTE_RESULTS",
      votesYes,
      votesNo,
      approved,
    });
  
    console.log(`📤 [VOTE_CREW] Résultats envoyés aux joueurs de la salle ${roomCode}`);
  
    if (!approved) {
      room.failedVotes += 1;
      console.log(`❌ [VOTE_CREW] Équipage rejeté. Nombre d'échecs consécutifs : ${room.failedVotes}`);
    
      if (room.failedVotes >= 2) {
        console.log(`🔄 [VOTE_CREW] Changement de capitaine après 2 échecs.`);
        room.failedVotes = 0;
        assignCaptain(roomCode); // On nomme un nouveau capitaine
      } else {
        // Tant qu'on n'a pas atteint 2 échecs, on renvoie le même capitaine
        // à la phase de sélection.
        broadcast(roomCode, { type: "CREW_SELECTION_PHASE" });
      }
    }
    else {
      broadcast(roomCode, { type: "ACTION_SELECTION_PHASE" });
    }
    
  
    // Réinitialiser les votes pour la prochaine phase
    room.players.forEach((p) => {
      delete p.vote;
    });
  
    console.log(`🔄 [VOTE_CREW] Votes réinitialisés pour la salle ${roomCode}`);
  }
  else {
    console.log(
      `⏳ [VOTE_CREW] En attente des votes restants dans la salle ${roomCode} (${votesReceived}/${totalVotesNeeded})`
    );
  }
}
if (type === "ACTION_SUBMITTED" && roomCode) {
  const { action } = data;
  const room = rooms[roomCode];
  console.log(`📩 [ACTION_SUBMITTED] Reçu pour la salle ${roomCode} de la part de ${username}`);
  if (!room) return;

  const player = room.players.find((p) => p.username === username);
  if (!player) return;

  // Vérifie d’abord si c'est un membre de l'équipage
  if (!player.isCrewMember) {
    console.log(`❌ [ACTION_SUBMITTED] ${username} n'est pas dans l'équipage`);
    return;
  }
  else {
    console.log(`✅ [ACTION_SUBMITTED] ${username} est dans l'équipage`);
  }
  console.log(`📩 [ACTION_SUBMITTED] ${username} a choisi ${action}`);
  // Si le joueur n'avait pas déjà choisi
  if (!player.currentAction) {
    player.currentAction = action;
    console.log(`🛠️ [ACTION_SUBMITTED] ${username} a choisi ${action}`);

    // Incrémente le compteur
    room.crewActionsCount = (room.crewActionsCount || 0) + 1;
    console.log(
      `🔢 [ACTION_SUBMITTED] Incrémentation du compteur => ${room.crewActionsCount}`
    );
    console.log(`🔢 [ACTION_SUBMITTED] Nombre total de joueurs dans l'équipage : ${room.crewActionsCount}`);
    // Si on a atteint 3 joueurs => tous ont choisi
    if (room.crewActionsCount === 3) {
      console.log(`✅ [ACTION_SUBMITTED] Les 3 membres ont choisi !`);
      // Calcule le résultat
      revealActions(roomCode);
    }
  } else {
    console.log(
      `⚠️ [ACTION_SUBMITTED] ${username} avait déjà choisi ${player.currentAction}`
    );
  }
}
      
           
    } catch (error) {
      console.error("❌ Erreur WebSocket :", error);
    }
  });
  

  ws.on("close", () => {
    console.log("🔴 Client déconnecté");
    handlePlayerDisconnection(ws);
  });
});

/**
 * 🔥 Génère un code de room aléatoire.
 */
function generateRoomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

/**
 * 🔎 Recherche une salle existante.
 */
function findExistingRoom() {
  for (const roomCode in rooms) {
    if (rooms[roomCode].length < 7) {
      return roomCode;
    }
  }
  return null;
}

function assignCaptain(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.players.length === 0) {
    console.error(`❌ Pas de joueurs dans la salle ${roomCode}`);
    return;
  }

  // Filtrer les joueurs qui n'ont jamais été capitaine
  const availablePlayers = room.players.filter(
    (p) => !room.usedCaptains.includes(p.username)
  );

  if (availablePlayers.length === 0) {
    console.log("⚠️ Tous les joueurs ont déjà été capitaines, on réinitialise la liste.");
    room.usedCaptains = [];
    // On relance la fonction en boucle pour forcer un choix
    return assignCaptain(roomCode);
  }

  // Choisir le premier ou un hasard
  const newCaptain = availablePlayers[0]; 


  // Marquer tous isCaptain = false, sauf newCaptain
  room.players.forEach((player) => {
    player.isCaptain = player.username === newCaptain.username;
  });

  // Ajouter ce capitaine à la liste usedCaptains
  room.usedCaptains.push(newCaptain.username);

  console.log(`👑 Nouveau capitaine : ${newCaptain.username}`);
  broadcast(roomCode, {
    type: "CAPTAIN_SELECTED",
    captain: newCaptain.username,
    avatar: newCaptain.avatar,
  });
}



/**
 * 📡 Sélectionne un capitaine pour la salle
 */
function assignCaptain(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.players.length === 0) {
    console.error(`❌ Pas de joueurs dans la salle ${roomCode}`);
    return;
  }

  room.currentCaptainIndex =
    (room.currentCaptainIndex + 1) % room.players.length;

  const currentCaptain = room.players[room.currentCaptainIndex];
  room.players.forEach((player) => {
    player.isCaptain = player.username === currentCaptain.username;
  });

  console.log(`👑 Nouveau capitaine : ${currentCaptain.username}`);
  broadcast(roomCode, {
    type: "CAPTAIN_SELECTED",
    captain: currentCaptain.username,
    avatar: currentCaptain.avatar,
  });
}


/**
 * 📡 Envoie un message à tous les joueurs d'une salle.
 */
function broadcast(roomCode, message) {
  const room = rooms[roomCode];
  if (!room) {
    console.warn(`⚠️ Aucune salle trouvée pour ${roomCode}`);
    return;
  }

  // Itérer sur les joueurs dans room.players
  room.players.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn(`⚠️ WebSocket non ouvert pour un client dans la salle ${roomCode}`);
    }
  });
  console.log(`📤 Message diffusé à la salle ${roomCode}:`, message);
}



/**
 * 🧹 Gère la déconnexion d'un joueur et nettoie les rooms.
 */
function handlePlayerDisconnection(ws) {
  Object.keys(rooms).forEach((roomCode) => {
    const room = rooms[roomCode];

    // Trouve et supprime le joueur correspondant au WebSocket déconnecté
    const updatedPlayers = room.players.filter((player) => player.ws !== ws);

    if (updatedPlayers.length === 0) {
      console.log(`🧹 Suppression de la salle vide : ${roomCode}`);
      delete rooms[roomCode];
    } else {
      room.players = updatedPlayers;
      console.log(`🔄 Mise à jour des joueurs dans la salle ${roomCode}`);

      // Diffuse la mise à jour de la salle aux joueurs restants
      const playersList = updatedPlayers.map(({ username, avatar }) => ({ username, avatar }));
      broadcast(roomCode, { type: "ROOM_UPDATE", players: playersList });
    }
  });
}

function revealActions(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  // Récupère les membres de l'équipage
  const crew = room.players.filter((p) => p.isCrewMember);

  // Compte le nombre de "poison" et "île"
  const poisonCount = crew.filter((p) => p.currentAction === "poison").length;

  const hasPoison = poisonCount > 0; // Si au moins un poison
  const winningSide = hasPoison ? "pirates" : "marins";

  // Initialisation des scores si ce n'est pas déjà fait
  room.piratesScore = room.piratesScore || 0;
  room.marinsScore = room.marinsScore || 0;

  // Mise à jour des scores en fonction des actions
  if (hasPoison) {
    room.piratesScore += 1;
    console.log(`🏴‍☠️ [revealActions] Poison(s) détecté(s) : Pirates +1`);
  } else {
    room.marinsScore += 1;
    console.log(`⚓ [revealActions] Aucune poison : Marins +1`);
  }

  // Prépare la liste des actions
  const actions = crew.map((p) => ({
    username: p.username,
    action: p.currentAction,
  }));

  // Diffuse les résultats et scores
  const piratesScore = room.players
    .filter((p) => p.role === "Pirate")
    .reduce((sum, p) => sum + (p.piratePoints || 0), 0);

  const marinsScore = room.players
    .filter((p) => p.role === "Marin")
    .reduce((sum, p) => sum + (p.marinPoints || 0), 0);

    broadcast(roomCode, {
      type: "ACTIONS_REVEALED",
      actions,
      winningSide,
      piratesScore: room.piratesScore,
      marinsScore: room.marinsScore,
    });

  console.log(`📤 [revealActions] ACTIONS_REVEALED :`, {
    actions,
    winningSide,
    piratesScore,
    marinsScore,
  });

  // Reset des actions
  room.players.forEach((p) => (p.currentAction = null));
  room.crewActionsCount = 0;
  console.log(`♻️ [revealActions] Remise à zéro de currentAction et crewActionsCount`);

  // Préparer la prochaine phase
  console.log('nombre de manches jouées', room.currentRound);
  setTimeout(() => {
    // Incrémenter le round
    room.currentRound += 1;
    console.log(`🔄 Fin du tour ${room.currentRound - 1}, on passe au tour ${room.currentRound}`);

    // Vérifier si on a atteint le maxRounds
    if (room.currentRound > room.maxRounds) {
      // Fin de la partie
      endGame(roomCode);
    } else {
      // Préparer un nouveau tour
      resetForNewRound(room);
      assignCaptain(roomCode);
    }
  }, 3000);
}


function endGame(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  console.log(`🏆 [endGame] La partie dans la salle ${roomCode} est terminée !`);

  // On pourrait calculer le score final (piratePoints vs marinPoints)
  const piratesScore = room.players
    .filter((p) => p.role === "Pirate")
    .reduce((sum, p) => sum + (p.piratePoints || 0), 0);
  const marinsScore = room.players
    .filter((p) => p.role === "Marin")
    .reduce((sum, p) => sum + (p.marinPoints || 0), 0);

  let winner = "";
  if (piratesScore > marinsScore) {
    winner = "pirates";
  } else if (marinsScore > piratesScore) {
    winner = "marins";
  } else {
    winner = "égalité";
  }

  broadcast(roomCode, {
    type: "GAME_END",
    piratesScore,
    marinsScore,
    winner,
  });

  // Option : on peut laisser la salle ouverte ou la supprimer
  // delete rooms[roomCode];
}


function resetForNewRound(room) {
  room.players.forEach((p) => {
    p.isCrewMember = false;
    p.roleConfirmed = true; // si vous ne refaites pas de distribution
    p.currentAction = null;
    delete p.vote;
  });
  room.crewActionsCount = 0;
  room.failedVotes = 0; // Si vous voulez un nouveau cycle de votes
}

function assignRoles(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.players.length < 7 || room.players.length > 20) {
    console.error(`❌ Nombre de joueurs invalide dans la salle ${roomCode}.`);
    return;
  }

  const totalPlayers = room.players.length;

  // Calculer le nombre de rôles nécessaires
  const numPirates = Math.floor(totalPlayers / 3); // Environ 1/3 des joueurs sont des pirates
  const numMarins = totalPlayers - numPirates; // Le reste sont des marins

  // Créer les rôles en conséquence
  const roles = [
    ...Array(numMarins).fill("Marin"),
    ...Array(numPirates).fill("Pirate"),
  ].sort(() => Math.random() - 0.5); // Mélanger les rôles

  console.log(`🎲 Rôles générés pour la salle ${roomCode} :`, roles);

  // Assigner les rôles aux joueurs
  room.players.forEach((player, index) => {
    const role = roles[index];
    player.role = role;

    if (player.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: "YOUR_ROLE",
        role,
      };
      console.log(`📤 Envoi du rôle à ${player.username} :`, message);
      player.ws.send(JSON.stringify(message));
    } else {
      console.warn(`⚠️ Connexion WebSocket fermée pour ${player.username}, rôle non envoyé.`);
    }

    console.log(`🎭 Rôle attribué : ${player.username} → ${role}`);
  });
}

