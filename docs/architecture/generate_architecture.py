"""Generate the three current architecture SVGs in this folder."""
from pathlib import Path
from html import escape
import json

ROOT = Path(__file__).parent
COLORS = {
    'person': ('#e6f4ef', '#39826b', '#225e4d'),
    'system': ('#e8f0fe', '#3b6ac4', '#234a94'),
    'container': ('#edf3ff', '#5a7fb9', '#284b82'),
    'external': ('#f1f3f6', '#8994a4', '#4a5669'),
    'future': ('#fff6e5', '#c49a42', '#7c5b1d'),
}

class Diagram:
    def __init__(self, title, width, height):
        self.width, self.height = width, height
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
          f'<title id="title">{escape(title)}</title><desc id="desc">{escape(title)}</desc>',
          '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#54677e"/></marker><marker id="conditional" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#a67c2d"/></marker></defs>',
          '<style>text{font-family:Arial,Helvetica,sans-serif;fill:#22334b}.edge{fill:none;stroke:#54677e;stroke-width:2;marker-end:url(#arrow);stroke-linejoin:round}.conditional{fill:none;stroke:#a67c2d;stroke-width:2;stroke-dasharray:8 6;marker-end:url(#conditional)}</style>',
          f'<rect width="{width}" height="{height}" fill="#fff"/>',
          f'<rect x="0" y="0" width="{width}" height="82" fill="#142b47"/>']
        self.text(46, 46, title, 31, '#fff', True)
    def text(self, x, y, text, size=19, color='#22334b', bold=False, anchor='start'):
        self.parts.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" style="fill:{color}" font-weight="{700 if bold else 400}" text-anchor="{anchor}">{escape(text)}</text>')
    def box(self, x, y, w, h, title, lines=(), kind='container', tag='', refs=()):
        fill, stroke, ink = COLORS[kind]
        dash = ' stroke-dasharray="8 5"' if kind == 'future' else ''
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="1.7"{dash}/>')
        top = y + 27
        if tag:
            self.text(x+20, top, tag.upper(), 12, ink, True); top += 31
        else: top += 8
        self.text(x+20, top, title, 22, ink, True)
        for i, line in enumerate(lines): self.text(x+20, top+32+26*i, line, 18)
        for i, ref in enumerate(refs): self.text(x+20, y+h-18-(len(refs)-1-i)*19, ref, 13, ink)
    def boundary(self,x,y,w,h,label):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="none" stroke="#8798ad" stroke-width="1.5" stroke-dasharray="9 6"/>')
        self.text(x+18,y+27,label,16,'#52657e',True)
    def edge(self, points, label='', x=0, y=0, conditional=False):
        path=' '.join(('M' if i==0 else 'L')+f'{a} {b}' for i,(a,b) in enumerate(points))
        self.parts.append(f'<path class="{"conditional" if conditional else "edge"}" d="{path}"/>')
        if label:
            width=len(label)*8.2+16
            self.parts.append(f'<rect x="{x-7}" y="{y-18}" width="{width}" height="25" rx="4" fill="#fff"/>')
            self.text(x,y,label,16,'#52657e')
    def note(self,x,y,title,lines,w=1400):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{56+25*len(lines)}" rx="8" fill="#f6f8fb" stroke="#dce3ec"/>')
        self.text(x+18,y+27,title,17,'#334c6b',True)
        for i,line in enumerate(lines): self.text(x+18,y+55+25*i,line,16,'#52657e')
    def save(self,name):
        self.parts.append('</svg>')
        (ROOT/name).write_text('\n'.join(self.parts)+'\n')

# Level 1: people and whole software systems only.
d=Diagram('C1 | ConnectSphere system context',1600,1090)
d.box(60,175,360,150,'Event Organiser',['Draft and submit event requests','Answer questions; request changes','View own organisation arrangements'],'person','Person')
d.box(620,150,360,155,'Coordinator Lead',['Assign and reassign Coordinators','Oversee active events and workloads'],'person','Person')
d.box(1180,175,360,150,'Event Coordinator',['Review assigned requests','Plan venues, equipment and safety','Confirm and manage event changes'],'person','Person')
d.box(60,455,360,150,'Venue Staff',['Maintain and block/retire venues','Set setup and turnaround durations','Approve bookings and replacements'],'person','Person')
d.box(1180,455,360,150,'Technical Support Staff',['Review and reserve equipment','Maintain catalogue and unit condition','Inspect returns and record defects'],'person','Person')
d.box(60,745,360,150,'Safety Officer',['Review operational feasibility','Approve, reject or request changes'],'person','Person')
d.box(1180,745,360,150,'Attendee',['Create account; register or withdraw','Join waiting list and respond to offers'],'person','Person')
d.box(535,415,530,220,'ConnectSphere',['Coordinates event requests and arrangements','Checks suitability, conflicts and readiness','Retains decisions, reviews and audit history','Provides role- and organisation-scoped access'],'system','Software system')
d.edge([(420,250),(480,250),(480,465),(535,465)],'Uses',442,366)
d.edge([(800,305),(800,415)],'Assigns / oversees',820,365)
d.edge([(1180,250),(1120,250),(1120,465),(1065,465)],'Uses',1135,366)
d.edge([(420,530),(535,530)],'Uses',448,516)
d.edge([(1180,530),(1065,530)],'Uses',1097,516)
d.edge([(420,820),(480,820),(480,585),(535,585)],'Uses',437,695)
d.edge([(1180,820),(1120,820),(1120,585),(1065,585)],'Uses',1135,695)
d.box(595,825,410,155,'Email delivery provider',['Receives application notification emails','Delivers to relevant user recipients','Channels follow saved preferences'],'external','External software system')
d.edge([(800,635),(800,825)],'Requests email delivery',820,739)
for x, kind, label in [(60,'person','Person'),(420,'system','Software system'),(900,'external','External system')]:
 fill,stroke,_=COLORS[kind]
 d.parts.append(f'<rect x="{x}" y="1025" width="26" height="20" rx="4" fill="{fill}" stroke="{stroke}"/>')
 d.text(x+38,1041,label,16)
d.save('c1-context.svg')

# C2/C3 retain the earlier diagrams' visual grammar and module layout.
e = escape
P = ROOT
class LegacyDiagram:
 def __init__(self,title,w=1440,h=1000):
  self.w,self.h=w,h
  self.s=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img"><title>{e(title)}</title><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9" fill="#52647a"/></marker></defs><style>text{{font-family:Arial,sans-serif;fill:#203047}} .title{{font-size:30px;font-weight:700}} .head{{font-size:19px;font-weight:700}} .body{{font-size:16px}} .small{{font-size:14px}} .edge{{fill:none;stroke:#52647a;stroke-width:1.8;marker-end:url(#arrow)}} </style><rect width="100%" height="100%" fill="#fff"/>']
  self.text(40,48,title,'title')
 def text(self,x,y,t,cls='body',anchor='start'):
  self.s.append(f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{e(t)}</text>')
 def box(self,x,y,w,h,title,lines=(),kind='normal'):
  colors={'normal':('#eef4ff','#7a99c5'),'person':('#e6f4f2','#4a8d85'),'external':('#f0f1f4','#929baa'),'planned':('#fff8e9','#bc933b')}
  fill,stroke=colors[kind]
  self.s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
  self.text(x+w/2,y+30,title,'head','middle')
  for i,t in enumerate(lines):self.text(x+w/2,y+57+23*i,t,'body','middle')
 def boundary(self,x,y,w,h,label):
  self.s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="none" stroke="#9aaec5" stroke-dasharray="6 5"/>');self.text(x+16,y+24,label,'small')
 def edge(self,points,label=None,lx=0,ly=0):
  self.s.append('<path class="edge" d="'+' '.join(('M' if i==0 else 'L')+f'{x},{y}' for i,(x,y) in enumerate(points))+'"/>')
  if label:
   self.s.append(f'<rect x="{lx-4}" y="{ly-15}" width="{len(label)*7.6+8}" height="20" fill="white"/>');self.text(lx,ly,label,'small')
 def save(self,name):
  self.s.append('</svg>');(P/name).write_text('\n'.join(self.s)+'\n')


D=LegacyDiagram('C2 · ConnectSphere containers',w=1440,h=1120)
D.boundary(340,115,1060,730,'ConnectSphere')
D.box(40,170,260,120,'Users',['Organiser, Lead, Coordinator','Venue, Technical, Safety staff','Attendee'],'person')
D.box(390,170,350,120,'Web application',['React + TypeScript / Vite','Role-specific browser interface'])
D.box(970,170,350,120,'Authentication',['Supabase Auth','Sign-in and session tokens'])
D.box(390,400,350,120,'Data API',['Supabase PostgREST / RPC','JWT-scoped reads and checked writes'])
D.box(970,400,350,120,'Notification sender',['Supabase Edge Function / Deno','Claims outbox; records send results'])
D.boundary(365,615,985,195,'PostgreSQL runtime')
D.box(390,660,350,120,'Database',['PostgreSQL on Supabase','RLS, atomic rules, data and audit'])
D.box(970,660,350,120,'Scheduled SQL jobs',['pg_cron only where available','Waiting offers; overdue completion'],'planned')
D.box(970,915,350,100,'Email service',['External SMTP • Gmail'],'external')
D.edge([(300,230),(390,230)],'uses',321,218)
D.edge([(740,225),(970,225)],'HTTPS: sign-in / refresh',768,213)
D.edge([(565,290),(565,400)],'HTTPS + session JWT',580,353)
D.edge([(565,520),(565,660)],'SQL / authorised RPC',580,588)
D.edge([(970,460),(740,460)],'HTTPS: outbox reads / updates',752,447)
D.edge([(970,720),(740,720)],'calls checked SQL functions',755,706)
D.edge([(1320,460),(1360,460),(1360,965),(1320,965)],'SMTP / TLS :465',1200,886)
D.text(40,1055,'Solid arrows: runtime calls and dependencies.','body')
D.text(40,1085,'Amber: scheduled SQL jobs, conditional on pg_cron. Grey: external email system.','body')
D.save('c2-containers.svg')

D=LegacyDiagram('C3 · ConnectSphere feature modules',w=2200,h=2560)
D.box(430,120,1340,95,'Application users',
 ['Organiser · Coordinator Lead · Coordinator · Venue Staff · Technical Support · Safety Officer · Attendee'],'person')
D.boundary(35,250,2130,1930,'Web application container • React + TypeScript')
D.boundary(80,290,2060,1490,'Feature modules')
modules=[
 (100,350,'Event Request Module',['Create, save, reopen and submit requests','Status, organisation scope and clarification replies','US1 / US2 / US3 / US22 / US31 / US37']),
 (850,350,'Change Request Module',['Propose changes; answer field clarification','Retain requested values, replies and outcomes','US6 / US7 clarification integration']),
 (1600,350,'Change Review Module',['Compare current and proposed values','Approve, reject or clarify each field','US7 • significant changes trigger revalidation']),
 (100,730,'Assignment Module',['Lead assigns / reassigns Coordinators','Unassigned queue, active events and workloads','US17 / US36 • assigned-only management']),
 (850,730,'Event Review Module',['Review, approve, reject or clarify requests','Read clarification replies and decision history','US4 / US37 • approval starts planning']),
 (1600,730,'Revalidation Module',['Track affected venue / equipment reasons','Resolve one reason; retain actor and history','US41 • change, resource and reschedule flags']),
 (100,1160,'Venue Booking Module',['Catalogue, search, suitability, calendar and holds','15-minute buffers; multi-venue staff decisions','Blocks, retirement, replacement; keep siblings','US8 / US9–12 / US18–19 / US46–49']),
 (850,1160,'Equipment Booking Module',['Requirements, stock checks and reservations','Catalogue, unit condition, return inspections','US13 / US14 / US24 / US27']),
 (1600,1160,'Readiness & Safety Module',['Check required arrangements; explicitly send','Officer decision; revisions and resubmission','US5 / US26 / US43 / US44 / US45','Open reviews block readiness; registration exempt']),
 (100,1600,'Event Lifecycle Module',['Plan, postpone, reschedule, cancel and complete','Confirmed summaries and event audit display','US20 / US21 / US26 / US34 / US38 / US42']),
 (850,1600,'Registration Module',['Enable registration; confirmed-event capacity','Register, withdraw, waiting offers and visibility','US15 / US16 / US23 / US29 / US52 / US54']),
 (1600,1600,'Notification Module',['Recipient-scoped notices and read state','Per-type in-app / email preferences','US32 / US33 • producers are in the backend']),
]
cleaned=[]
for x,y,title,lines in modules:
 display=[]
 for line in lines:
  if line.startswith('US'):
   if ' • ' in line:
    value=line.split(' • ',1)[1]
    display.append(value[:1].upper()+value[1:])
  else: display.append(line)
 cleaned.append((x,y,title,display))
modules=cleaned
for x,y,title,lines in modules: D.box(x,y,500,160,title,lines)
D.s.append('<defs><marker id="flow-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9" fill="#936238"/></marker></defs>')
flows=[]
def relation(source,target,points,label,x,y):
 path=' '.join(('M' if i==0 else 'L')+f'{a},{b}' for i,(a,b) in enumerate(points))
 D.s.append(f'<path d="{path}" fill="none" stroke="#936238" stroke-width="1.8" stroke-dasharray="7 5" marker-end="url(#flow-arrow)"/>')
 D.s.append(f'<rect x="{x-4}" y="{y-16}" width="{len(label)*7.7+8}" height="22" fill="white"/>');D.text(x,y,label,'small')
 flows.append({'source':source,'target':target,'relationship':label,'kind':'workflow/data through persisted state and backend operations'})
D.edge([(1100,215),(1100,290)],'uses modules permitted for their role',1120,240)
relation('Event Request','Change Request',[(600,425),(850,425)],'request to amend',625,409)
relation('Change Request','Change Review',[(1350,425),(1600,425)],'proposals / replies',1380,409)
relation('Change Review','Change Request',[(1700,350),(1700,325),(1200,325),(1200,350)],'field questions / outcomes',1270,317)
relation('Event Request','Assignment',[(350,510),(350,730)],'submitted, unassigned requests',365,615)
relation('Assignment','Event Review',[(600,810),(850,810)],'assigned requests',628,795)
relation('Change Review','Revalidation',[(1850,510),(1850,730)],'approved significant changes',1865,615)
relation('Event Review','Equipment Booking',[(1100,890),(1100,1160)],'equipment requirements',1115,946)
relation('Event Review','Venue Booking',[(950,890),(950,995),(350,995),(350,1160)],'approved event / venue needs',420,978)
relation('Revalidation','Venue Booking',[(1700,890),(1700,1030),(450,1030),(450,1160)],'venue flags / reasons',1415,1013)
relation('Revalidation','Equipment Booking',[(1800,890),(1800,1070),(1250,1070),(1250,1160)],'equipment flags / reasons',1425,1053)
relation('Venue Booking','Readiness & Safety',[(600,1260),(740,1260),(740,1110),(1850,1110),(1850,1160)],'venue decisions, capacity and restrictions',1280,1093)
relation('Equipment Booking','Readiness & Safety',[(1350,1230),(1600,1230)],'reservation readiness',1377,1213)
relation('Readiness & Safety','Event Lifecycle',[(2000,1320),(2000,1430),(350,1430),(350,1600)],'safety approval / outstanding actions',1060,1413)
relation('Event Lifecycle','Venue Booking',[(100,1680),(60,1680),(60,950),(200,950),(200,1160)],'revised venue arrangements',95,1520)
relation('Event Lifecycle','Equipment Booking',[(500,1600),(500,1500),(1100,1500),(1100,1320)],'revised equipment arrangements',650,1483)
relation('Event Lifecycle','Registration',[(600,1680),(850,1680)],'confirmed, open events',611,1663)
relation('Registration','Notification',[(1350,1680),(1600,1680)],'registration updates',1377,1663)
D.box(100,1950,500,120,'Auth Module',['Session, profile and role context','Sign-in and session lifecycle'])
D.box(850,1950,500,120,'Shared UI Components',['Navigation, forms, badges and errors','Reusable presentation and feedback'])
D.box(1600,1950,500,120,'Supabase Client',['One configured supabase-js client','Used by services inside each module'])
D.edge([(350,1780),(350,1950)],'uses session / role context',365,1895)
D.edge([(1100,1780),(1100,1950)],'reuses UI components',1115,1895)
D.edge([(1850,1780),(1850,1950)],'services query / call RPCs',1865,1895)
D.edge([(350,2070),(350,2135),(1850,2135),(1850,2070)],'sign-in / refresh session through client',885,2120)
D.box(700,2290,600,100,'Supabase Data API / RPC',['PostgreSQL enforces permissions and business rules'],'external')
D.box(1600,2290,500,100,'Supabase Auth',['Authentication service'],'external')
D.edge([(1710,2070),(1710,2220),(1000,2220),(1000,2290)],'HTTPS: authorised reads / business operations',1130,2205)
D.edge([(2040,2070),(2040,2290)],'HTTPS: auth',1900,2266)
D.text(100,2440,'Dashed brown: workflow / data relationships through backend records and operations.','body')
D.text(100,2470,'Solid slate: technical dependencies. Shared-support links apply across the feature modules.','body')
D.text(100,2500,'Crossings without junctions are not connections. Grey: external container references.','body')
D.save('c3-components.svg')
(ROOT/'component-map.json').write_text(json.dumps([{'component':title,'responsibilities':lines} for _,_,title,lines in modules],indent=2)+'\n')
(ROOT/'interaction-map.json').write_text(json.dumps(flows,indent=2)+'\n')
print('Generated the three diagrams with titles, diagram content and legends.')
