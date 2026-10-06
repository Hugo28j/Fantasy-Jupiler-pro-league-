-- 011: herstel vaste beginprijzen en voorkom prijswijzigingen voor DNP's.
--
-- Audit 2026-10-06:
--   * 552 actieve spelers gecontroleerd
--   * 543 historische DNP-rijen kregen foutief -€1M
--   * enkele marketBasePrice-waarden waren al door eerdere prijsruns vervuild
--
-- Vanaf nu:
--   * iedere speler heeft exact één permanente beginprijs in market_initial_prices
--   * oude seedspelers krijgen hun oorspronkelijke gebalanceerde prijs terug
--   * overige Sorare-spelers behouden hun eerste geldige basisprijs, max €24M
--     (Hans Vanaken €25M)
--   * 0 speelminuten = €0 prijsverandering
--   * alle gespeelde wedstrijden worden daarna opnieuw chronologisch doorgerekend

create extension if not exists unaccent with schema extensions;

create or replace function public.normalize_market_name(p_name text)
returns text
language sql
stable
set search_path=public,extensions
as $$
  select regexp_replace(lower(extensions.unaccent(coalesce(p_name,''))),'[^a-z0-9]+','','g');
$$;

create table if not exists public.market_initial_prices (
  player_id text primary key references public.players(id) on delete cascade,
  initial_price numeric(8,1) not null check(initial_price >= 1),
  source text not null default 'sorare-import',
  updated_at timestamptz not null default now()
);

alter table public.market_initial_prices enable row level security;
revoke all on table public.market_initial_prices from anon,authenticated;

with seed(normalized_name,initial_price,display_name) as (
  values
    ('aaronbibout',10.5,'Aaron Bibout'),
    ('abdoulayesissako',13.0,'Abdoulaye Sissako'),
    ('abdoulayinde',6.0,'Abdoul Ayindé'),
    ('abdouliemanneh',6.0,'Abdoulie Manneh'),
    ('abdulayinde',6.0,'Abdul Ayindé'),
    ('adamabojang',12.0,'Adama Bojang'),
    ('ademzorgane',16.5,'Adem Zorgane'),
    ('adnaneabid',16.5,'Adnane Abid'),
    ('adrianobertaccini',21.0,'Adriano Bertaccini'),
    ('ahmadaburasyin',1.5,'Ahmad Aburasyin'),
    ('aihamousou',10.5,'Aiham Ousou'),
    ('alexistrouillet',12.0,'Alexis Trouillet'),
    ('alimaamar',13.0,'Ali Maamar'),
    ('amandolapage',10.5,'Amando Lapage'),
    ('amineboukamir',10.5,'Amine Boukamir'),
    ('andizeqiri',18.0,'Andi Zeqiri'),
    ('andreasjungdal',11.5,'Andreas Jungdal'),
    ('andregarcia',6.0,'Andre Garcia'),
    ('andrejvasovic',1.5,'Andrej Vasovic'),
    ('anosikeementa',21.0,'Anosike Ementa'),
    ('arbnormuja',13.5,'Arbnor Muja'),
    ('argusvandendriessche',1.5,'Argus Vanden Driessche'),
    ('arnoverschueren',10.5,'Arno Verschueren'),
    ('arthurcremer',1.5,'Arthur Cremer'),
    ('arthurvermeeren',18.0,'Arthur Vermeeren'),
    ('atlibarkarson',7.5,'Atli Barkarson'),
    ('aurelienscheidler',15.0,'Aurélien Scheidler'),
    ('axldecorte',3.0,'Axl De Corte'),
    ('basevers',1.5,'Bas Evers'),
    ('baslangenbick',1.5,'Bas Langenbick'),
    ('belmindizdarevic',1.5,'Belmin Dizdarevic'),
    ('benitoraman',15.0,'Benito Raman'),
    ('benjamintahirovic',15.0,'Benjamin Tahirovic'),
    ('besfortzeneli',22.5,'Besfort Zeneli'),
    ('billlathouwers',6.0,'Bill Lathouwers'),
    ('birgerverstraete',13.5,'Birger Verstraete'),
    ('borislambert',6.0,'Boris Lambert'),
    ('botondbalogh',10.5,'Botond Balogh'),
    ('brandonmechele',15.0,'Brandon Mechele'),
    ('brentgabriel',5.5,'Brent Gabriël'),
    ('brunogodeau',9.0,'Bruno Godeau'),
    ('bryanheynen',21.0,'Bryan Heynen'),
    ('bryansoumare',10.5,'Bryan Soumaré'),
    ('carlosforbs',22.5,'Carlos Forbs'),
    ('caspernielsen',16.5,'Casper Nielsen'),
    ('charlesherrmann',7.5,'Charles Herrmann'),
    ('checkkeita',12.0,'Check Keita'),
    ('cheickkeita',12.0,'Cheick Keita'),
    ('cheveyotsawa',6.0,'Cheveyo Tsawa'),
    ('chrisemmanuellokesa',10.5,'Chris-Emmanuel Lokesa'),
    ('chrislokesa',10.5,'Chris Lokesa'),
    ('christiaanravych',12.0,'Christiaan Ravych'),
    ('christianbruls',9.0,'Christian Brüls'),
    ('christianburgess',13.5,'Christian Burgess'),
    ('christophejanssens',7.5,'Christophe Janssens'),
    ('christopherscott',11.5,'Christopher Scott'),
    ('cissesandra',13.5,'Cisse Sandra'),
    ('colincoosemans',13.5,'Colin Coosemans'),
    ('daamfoulon',12.0,'Daam Foulon'),
    ('daanheymans',18.0,'Daan Heymans'),
    ('dagoourega',11.5,'Dago Ourega'),
    ('danivandenheuvel',10.5,'Dani van den Heuvel'),
    ('danterigo',10.5,'Dante Rigo'),
    ('dantevanzeir',13.0,'Dante Vanzeir'),
    ('danylosikan',19.5,'Danylo Sikan'),
    ('davyroef',12.0,'Davy Roef'),
    ('dennispraet',18.0,'Dennis Praet'),
    ('dikenisalifou',7.5,'Dikeni Salifou'),
    ('dimitrilavalee',12.0,'Dimitri Lavalée'),
    ('dogucanhaspolat',13.5,'Dogucan Haspolat'),
    ('dominicthompson',7.5,'Dominic Thompson'),
    ('drieswouters',8.5,'Dries Wouters'),
    ('ebbedevlaeminck',1.5,'Ebbe De Vlaeminck'),
    ('eliasfilet',9.0,'Elias Filet'),
    ('emiledoucoure',1.5,'Émile Doucouré'),
    ('emmanueladdai',12.0,'Emmanuel Addai'),
    ('emmanuelkakou',7.5,'Emmanuel Kakou'),
    ('enriquelofolomo',12.0,'Enrique Lofolomo'),
    ('ewoudpletinckx',10.5,'Ewoud Pletinckx'),
    ('felixlemarechal',13.5,'Félix Lemaréchal'),
    ('florianvanbever',1.5,'Florian Van Bever'),
    ('freddiepotts',15.0,'Freddie Potts'),
    ('fredericsoellesoelle',6.0,'Frederic Soèllé Soèllé'),
    ('fredrikhammer',11.5,'Fredrik Hammer'),
    ('gaetancoucke',10.5,'Gaëtan Coucke'),
    ('gakunawata',10.5,'Gaku Nawata'),
    ('garymagnee',12.0,'Gary Magnée'),
    ('geoffreykondo',11.5,'Geoffrey Kondo'),
    ('gianlucaokonengstler',1.5,'Gianluca Okon-Engstler'),
    ('gillesdewaele',7.5,'Gilles Dewaele'),
    ('giulianbiancone',12.0,'Giulian Biancone'),
    ('goduinekoyalipou',12.0,'Goduine Koyalipou'),
    ('goradiouf',10.5,'Gora Diouf'),
    ('guilhermesmith',13.5,'Guilherme Smith'),
    ('hansvanaken',25.0,'Hans Vanaken'),
    ('harrisonmurraycampbell',6.0,'Harrison Murray-Campbell'),
    ('henokteklab',9.0,'Henok Teklab'),
    ('henrylawrence',9.0,'Henry Lawrence'),
    ('hervekoffi',16.5,'Hervé Koffi'),
    ('hugosiquet',15.0,'Hugo Siquet'),
    ('hugovetlesen',16.5,'Hugo Vetlesen'),
    ('ibehautekiet',12.0,'Ibe Hautekiet'),
    ('ibrahimdiakite',9.0,'Ibrahim Diakité'),
    ('ibrahimfofana',12.0,'Ibrahim Fofana'),
    ('ibrahimkaramoko',11.5,'Ibrahim Karamoko'),
    ('ibrahimsalah',15.0,'Ibrahim Salah'),
    ('iliassebaoui',14.5,'Ilias Sebaoui'),
    ('ismailacheickcoulibaly',13.0,'Ismaila Cheick Coulibaly'),
    ('jahnilowiegeltriebel',1.5,'Jahnilo Wiegel-Triebel'),
    ('jakobkiilerich',10.5,'Jakob Kiilerich'),
    ('jakobromsaas',13.0,'Jakob Romsaas'),
    ('jamielawrence',9.0,'Jamie Lawrence'),
    ('janvirgili',16.5,'Jan Virgili'),
    ('jasonvanduiven',8.5,'Jason Van Duiven'),
    ('jespertolinsson',6.0,'Jesper Tolinsson'),
    ('joaquinseys',18.0,'Joaquin Seys'),
    ('joelordonez',19.5,'Joel Ordóñez'),
    ('joeypelupessy',9.0,'Joey Pelupessy'),
    ('johannesschenk',8.5,'Johannes Schenk'),
    ('joriskayembe',14.5,'Joris Kayembe'),
    ('jornespileers',12.0,'Jorne Spileers'),
    ('josemarsa',11.5,'José Marsà'),
    ('josuekongolo',13.5,'Josué Kongolo'),
    ('josuevergara',15.0,'Josúe Vergara'),
    ('juhotalvitie',9.0,'Juho Talvitie'),
    ('junyaito',22.5,'Junya Ito'),
    ('justinheekeren',7.5,'Justin Heekeren'),
    ('kamielvandeperre',14.5,'Kamiel Van De Perre'),
    ('keoboets',1.5,'Keo Boets'),
    ('kevinmacallister',15.0,'Kevin Mac Allister'),
    ('kevinrodriguez',18.0,'Kevin Rodríguez'),
    ('kevinvandenkerkhof',16.0,'Kévin Van Den Kerkhof'),
    ('kianyvroman',4.5,'Kiany Vroman'),
    ('killiansardella',15.0,'Killian Sardella'),
    ('kjellpeersman',7.5,'Kjell Peersman'),
    ('kotatakai',12.0,'Kota Takai'),
    ('kyanvaesen',15.0,'Kyan Vaesen'),
    ('kyrianisabbe',12.0,'Kyriani Sabbe'),
    ('lassefl',7.5,'Lasse Flø'),
    ('laszlobenes',13.5,'László Bénes'),
    ('laurentjans',8.5,'Laurent Jans'),
    ('laurentlemoine',10.5,'Laurent Lemoine'),
    ('lazareamani',9.0,'Lazare Amani'),
    ('leehanbeom',13.5,'Lee Han-beom'),
    ('leehanbum',13.5,'Lee Han-Bum'),
    ('lennardhens',10.5,'Lennard Hens'),
    ('lennartmertens',7.5,'Lennart Mertens'),
    ('leokokubo',12.0,'Leo Kokubo'),
    ('leonardodasilvalopes',10.5,'Leonardo da Silva Lopes'),
    ('leopetrot',13.5,'Léo Pétrot'),
    ('liamdesmet',7.5,'Liam De Smet'),
    ('louisbostyn',10.0,'Louis Bostyn'),
    ('louispatris',13.5,'Louis Patris'),
    ('lucashey',12.0,'Lucas Hey'),
    ('lucasmonteiro',1.5,'Lucas Monteiro'),
    ('lucaspirard',6.0,'Lucas Pirard'),
    ('lucasschoofs',10.0,'Lucas Schoofs'),
    ('luccabrughmans',11.5,'Lucca Brughmans'),
    ('lucmarijnissen',9.0,'Luc Marijnissen'),
    ('ludwigaugustinsson',15.0,'Ludwig Augustinsson'),
    ('lukasambros',13.0,'Lukáš Ambros'),
    ('lukasmondele',10.5,'Lukas Mondele'),
    ('lynntaudoor',4.5,'Lynnt Audoor'),
    ('maksimpaskotsi',9.0,'Maksim Paskotsi'),
    ('malickmbaye',10.5,'Malick Mbaye'),
    ('mamadoudiakhon',7.5,'Mamadou Diakhon'),
    ('marcoilaimaharitra',13.5,'Marco Ilaimaharitra'),
    ('marcokana',13.5,'Marco Kana'),
    ('marcospeano',10.0,'Marcos Peano'),
    ('mardocheenzita',13.0,'Mardochee Nzita'),
    ('mariostroeykens',19.5,'Mario Stroeykens'),
    ('marleyake',13.5,'Marley Aké'),
    ('marlonfossey',12.0,'Marlon Fossey'),
    ('martindelavallee',6.0,'Martin Delavallée'),
    ('massimodecoene',7.5,'Massimo Decoene'),
    ('massiresylla',13.5,'Massire Sylla'),
    ('mathiasdelorge',12.0,'Mathias Delorge'),
    ('mathiasdelorgeknieper',12.0,'Mathias Delorge-Knieper'),
    ('matteodams',13.5,'Matteo Dams'),
    ('mattesmets',18.0,'Matte Smets'),
    ('matthewanderson',9.0,'Matthew Anderson'),
    ('matthiaspieklak',8.5,'Matthias Pieklak'),
    ('matthieuepolo',11.5,'Matthieu Epolo'),
    ('mattisseghers',1.5,'Mattis Seghers'),
    ('mattlendfers',4.5,'Matt Lendfers'),
    ('matyaskovacs',7.5,'Mátyás Kovács'),
    ('mauriciobenitez',10.5,'Mauricio Benítez'),
    ('maxdean',15.0,'Max Dean'),
    ('maximdeman',1.5,'Maxim Deman'),
    ('maximebusi',10.5,'Maxime Busi'),
    ('michaelfrey',16.5,'Michael Frey'),
    ('mikeeerdhuijzen',9.0,'Mike Eerdhuijzen'),
    ('milandeschutter',4.5,'Milan De Schutter'),
    ('milanrobberechts',4.5,'Milan Robberechts'),
    ('modibofofana',12.0,'Modibo Fofana'),
    ('mohamedkone',13.0,'Mohamed Koné'),
    ('momodousonko',13.5,'Momodou Sonko'),
    ('mouhamedbelkheir',12.0,'Mouhamed Belkheir'),
    ('mouhamedelbachirngom',10.5,'Mouhamed El Bachir Ngom'),
    ('mustaphaisah',20.5,'Mustapha Isah'),
    ('myronvanbrederode',15.0,'Myron van Brederode'),
    ('nachomiras',10.5,'Nacho Miras'),
    ('nathanaelmbuku',15.0,'Nathanaël Mbuku'),
    ('nayelmehssatou',8.5,'Nayel Mehssatou'),
    ('nicolasrommens',9.0,'Nicolas Rommens'),
    ('nicolotresoldi',20.5,'Nicolo Tresoldi'),
    ('nielsdevalckeneer',1.5,'Niels Devalckeneer'),
    ('nikohorvat',10.5,'Niko Horvat'),
    ('nikolaivezic',6.0,'Nikola Ivezic'),
    ('nikolastorm',12.0,'Nikola Storm'),
    ('noedussenne',12.0,'Noë Dussenne'),
    ('nohimchibani',6.0,'Nohim Chibani'),
    ('nolangillot',7.5,'Nolan Gillot'),
    ('nordinjackers',10.5,'Nordin Jackers'),
    ('normanbassette',15.0,'Norman Bassette'),
    ('ondrejkricfalusi',12.0,'Ondřej Kričfaluši'),
    ('ortwindewolf',9.0,'Ortwin De Wolf'),
    ('oscargil',11.5,'Óscar Gil'),
    ('ousseynouniang',9.0,'Ousseynou Niang'),
    ('owenjochmans',1.5,'Owen Jochmans'),
    ('patricknkoa',10.0,'Patrick Nkoa'),
    ('patrickpflucke',13.5,'Patrick Pflücke'),
    ('patrikgunnarsson',9.0,'Patrik Gunnarsson'),
    ('ralfseuntjens',7.5,'Ralf Seuntjens'),
    ('rayantouzghar',10.5,'Rayan Touzghar'),
    ('reinvanhelden',10.5,'Rein Van Helden'),
    ('rikvercauteren',1.5,'Rik Vercauteren'),
    ('robschoofs',15.0,'Rob Schoofs'),
    ('romeovermant',21.0,'Romeo Vermant'),
    ('rosssykes',12.0,'Ross Sykes'),
    ('ryanmerlen',9.0,'Ryan Merlen'),
    ('ryanteague',12.0,'Ryan Teague'),
    ('ryotaroaraki',13.5,'Ryotaro Araki'),
    ('sambacoulibaly',7.5,'Samba Coulibaly'),
    ('samuelgomezvanhoogen',4.5,'Samuel Gomez van Hoogen'),
    ('seijikimura',12.0,'Seiji Kimura'),
    ('serhiisydorchuk',10.5,'Serhii Sydorchuk'),
    ('shaquildelos',10.5,'Shaquil Delos'),
    ('shawnadewoye',7.5,'Shawn Adewoye'),
    ('shinyamada',7.5,'Shin Yamada'),
    ('shogotaniguchi',10.5,'Shogo Taniguchi'),
    ('shunsukesaito',11.5,'Shunsuke Saito'),
    ('siebendewaele',9.0,'Sieben Dewaele'),
    ('siebeschrijvers',13.5,'Siebe Schrijvers'),
    ('siebevanderheyden',13.0,'Siebe Van Der Heyden'),
    ('stevengoura',12.0,'Steve Ngoura'),
    ('stredairappuah',9.0,'Stredair Appuah'),
    ('sverrenypan',10.5,'Sverre Nypan'),
    ('taigahata',10.5,'Taiga Hata'),
    ('taishibrandonnozawa',10.5,'Taishi Brandon Nozawa'),
    ('taishinozawa',10.5,'Taishi Nozawa'),
    ('takuyaogiwara',10.5,'Takuya Ogiwara'),
    ('tayoadaramola',6.0,'Tayo Adaramola'),
    ('theloaasgaard',15.0,'Thelo Aasgaard'),
    ('therencekoudou',10.5,'Therence Koudou'),
    ('thibosomers',15.0,'Thibo Somers'),
    ('thierryambrose',10.5,'Thierry Ambrose'),
    ('thierrylutonda',9.0,'Thierry Lutonda'),
    ('thomasclaes',11.5,'Thomas Claes'),
    ('tiagoaraujo',13.5,'Tiago Araújo'),
    ('tiagopereiracardoso',7.5,'Tiago Pereira Cardoso'),
    ('tiankoren',3.0,'Tian Koren'),
    ('tiannaikoren',3.0,'Tian Nai Koren'),
    ('tijnvaningelgom',1.5,'Tijn Van Ingelgom'),
    ('timothyeyoma',8.5,'Timothy Eyoma'),
    ('tobeleysen',12.0,'Tobe Leysen'),
    ('tobiaslawal',7.5,'Tobias Lawal'),
    ('tobiasmohr',12.0,'Tobias Mohr'),
    ('tristonrowe',7.5,'Triston Rowe'),
    ('valykonate',10.5,'Valy Konaté'),
    ('vicchambaere',4.5,'Vic Chambaere'),
    ('victorolatunji',13.5,'Victor Olatunji'),
    ('viktorboone',9.0,'Viktor Boone'),
    ('visarmusliu',13.0,'Visar Musliu'),
    ('waganefaye',9.0,'Wagane Faye'),
    ('wilguenspaugain',9.0,'Wilguens Paugain'),
    ('wisdommike',9.0,'Wisdom Mike'),
    ('woutergeorge',11.5,'Wouter George'),
    ('woutverlinden',1.5,'Wout Verlinden'),
    ('xanderdierckx',11.5,'Xander Dierckx'),
    ('yaimarmedina',10.5,'Yaimar Medina'),
    ('yannickcappelle',10.5,'Yannick Cappelle'),
    ('yannickthoelen',7.5,'Yannick Thoelen'),
    ('yannlienard',4.5,'Yann Lienard'),
    ('yannsommer',18.0,'Yann Sommer'),
    ('yassinekhalifi',12.0,'Yassine Khalifi'),
    ('yllanokou',9.0,'Yllan Okou'),
    ('yutotsunashima',11.5,'Yuto Tsunashima')
)
insert into public.market_initial_prices(player_id,initial_price,source,updated_at)
select p.id,s.initial_price,'legacy-seed',now()
from public.players p
join seed s
  on s.normalized_name=public.normalize_market_name(p.name)
on conflict(player_id) do update set
  initial_price=excluded.initial_price,
  source='legacy-seed',
  updated_at=now();

-- Elke huidige speler die niet in de oude seed stond krijgt één vaste Sorare-basis.
-- Gebruik de oudste opgeslagen marketBasePrice als die bestaat; anders de huidige
-- importprijs. Oude vervuiling boven de originele limiet wordt afgekapt.
insert into public.market_initial_prices(player_id,initial_price,source,updated_at)
select
  p.id,
  case
    when public.normalize_market_name(p.name)='hansvanaken' then 25.0
    else greatest(
      1.0,
      least(
        24.0,
        coalesce(
          (
            select nullif(s.stats->>'marketBasePrice','')::numeric
            from public.player_match_stats s
            join public.fixtures f on f.id=s.fixture_id
            where s.player_id=p.id and f.status='FT'
            order by f.kickoff asc,s.fixture_id asc
            limit 1
          ),
          p.price,
          1.0
        )
      )
    )
  end,
  'sorare-import',
  now()
from public.players p
where not exists(
  select 1 from public.market_initial_prices m where m.player_id=p.id
)
on conflict(player_id) do nothing;


create or replace function public.recalculate_market_prices()
returns table(players_updated integer,history_rows_updated integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  p_rec record;
  r record;
  v_price numeric := 0;
  v_before numeric := 0;
  v_after numeric := 0;
  v_delta numeric := 0;
  v_points numeric := 0;
  v_ratio numeric := 0;
  v_players_updated integer := 0;
  v_history_updated integer := 0;
begin
  -- Nieuwe spelers die later via Sorare bijkomen krijgen bij hun eerste run
  -- automatisch hun dan geldende importprijs als permanente basis.
  insert into public.market_initial_prices(player_id,initial_price,source,updated_at)
  select
    p.id,
    case
      when public.normalize_market_name(p.name)='hansvanaken' then 25.0
      else greatest(1.0,least(24.0,coalesce(p.price,1.0)))
    end,
    'sorare-import',
    now()
  from public.players p
  where not exists(
    select 1 from public.market_initial_prices m where m.player_id=p.id
  )
  on conflict(player_id) do nothing;

  for p_rec in
    select p.id,p.price,m.initial_price
    from public.players p
    join public.market_initial_prices m on m.player_id=p.id
    order by p.id
  loop
    v_price := greatest(1,round(p_rec.initial_price::numeric,1));

    for r in
      select
        s.fixture_id,
        s.minutes,
        s.fantasy_points,
        s.stats,
        f.kickoff
      from public.player_match_stats s
      join public.fixtures f on f.id=s.fixture_id
      where s.player_id=p_rec.id
        and f.status='FT'
      order by f.kickoff asc,s.fixture_id asc
    loop
      v_before := round(v_price,1);
      v_points := coalesce(r.fantasy_points,0);

      -- Niet gespeeld = geen marktbeweging en geen prestatiepercentage.
      if coalesce(r.minutes,0) <= 0 then
        v_ratio := 0;
        v_delta := 0;
      else
        v_ratio := case
          when v_before > 0 then round((v_points/v_before)*100,1)
          else 0
        end;

        v_delta := case
          when v_points <= 0 then -1.0
          when v_ratio < 30 then -1.0
          when v_ratio < 40 then -0.7
          when v_ratio < 50 then -0.5
          when v_ratio < 90 then -0.3
          when v_ratio < 100 then 0.0
          when v_ratio < 110 then 0.3
          when v_ratio < 120 then 0.5
          when v_ratio < 140 then 1.0
          when v_ratio < 160 then 1.5
          else 2.0
        end;
      end if;

      v_after := greatest(1,round(v_before+v_delta,1));
      v_delta := round(v_after-v_before,1);

      update public.player_match_stats
      set stats=coalesce(stats,'{}'::jsonb) || jsonb_build_object(
        'marketBasePrice',p_rec.initial_price,
        'priceBefore',v_before,
        'priceDelta',v_delta,
        'priceAfter',v_after,
        'pricePerformancePct',v_ratio,
        'priceModelVersion',2
      ),
      updated_at=now()
      where fixture_id=r.fixture_id
        and player_id=p_rec.id;

      v_history_updated := v_history_updated+1;
      v_price := v_after;
    end loop;

    if abs(coalesce(p_rec.price,0)-v_price) > 0.001 then
      update public.players
      set price=v_price,updated_at=now()
      where id=p_rec.id;
      v_players_updated := v_players_updated+1;
    end if;
  end loop;

  return query select v_players_updated,v_history_updated;
end;
$$;

revoke all on function public.recalculate_market_prices() from public,anon,authenticated;
grant execute on function public.recalculate_market_prices() to service_role;

-- Herstel de volledige historie meteen wanneer deze migratie wordt uitgevoerd.
select * from public.recalculate_market_prices();
