select fav.title, fav."videoId", fav.url, fav.bpm, fav.key, note."songName", note."blocks" from "Favorite" as fav
inner join "Note" as note on note."userId" = fav."userId" and fav."videoId" = note."videoId"
where fav."userId"= 'cmuk8isfk00007ubr9tfec13n';
