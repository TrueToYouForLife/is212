"""Generate current architecture and retained workflow SVGs. Run: python3 docs/architecture/generate.py"""
from pathlib import Path
from html import escape as e
P=Path(__file__).parent
class Diagram:
 def __init__(self,title,subtitle,w=1440,h=1000):
  self.w,self.h=w,h
  self.s=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img"><title>{e(title)}</title><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9" fill="#52647a"/></marker></defs><style>text{{font-family:Arial,sans-serif;fill:#203047}} .title{{font-size:30px;font-weight:700}} .head{{font-size:19px;font-weight:700}} .body{{font-size:16px}} .small{{font-size:14px}} .edge{{fill:none;stroke:#52647a;stroke-width:1.8;marker-end:url(#arrow)}} </style><rect width="100%" height="100%" fill="#fff"/>']
  self.text(40,48,title,'title');self.text(40,79,subtitle,'body')
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
 def save(self,name,foot):
  self.text(40,self.h-24,foot,'small');self.s.append('</svg>');(P/name).write_text('\n'.join(self.s))

# Three readable workflow sheets replace crossing role-lane routes.
# Named continuation points connect sheets without long, ambiguous arrows.
def panel_note(d,y,lines):
 for i,line in enumerate(lines):d.text(45,y+i*27,line,'body')
D=Diagram('Workflow Part 1 · Request and review','Roles are written in each action. Follow labelled arrows; continuation A opens the arrangements sheet.',w=2200,h=920)
D.box(60,200,290,120,'Organiser: draft',['Create, save and reopen','Complete request details'])
D.box(450,200,290,120,'Organiser: submit',['Validate required information','Enter unassigned queue'])
D.box(850,200,290,120,'Lead: assign',['Review basic request details','Choose an Event Coordinator'])
D.box(1250,200,290,120,'Coordinator: review',['Review the full request','Record a reasoned decision'])
D.box(1750,200,370,120,'Review outcome?',['Approve, clarify or reject'],'planned')
D.edge([(350,260),(450,260)],'submit',371,245)
D.edge([(740,260),(850,260)],'valid',775,245)
D.edge([(1140,260),(1250,260)],'assigned',1159,245)
D.edge([(1540,260),(1750,260)],'record decision',1569,245)
D.edge([(590,200),(590,145),(205,145),(205,200)],'missing / invalid details: correct draft',280,132)
D.box(1250,490,370,120,'Organiser: clarify',['Answer Coordinator’s questions','Resubmit for another review'])
D.edge([(1810,320),(1810,390),(1435,390),(1435,490)],'clarification requested',1510,375)
D.edge([(1250,550),(1200,550),(1200,365),(1320,365),(1320,320)],'answers received: review again',877,400)
D.box(1750,490,370,120,'Request rejected',['Notify Organiser of reasons','Retain history; stop planning'],'external')
D.edge([(2120,260),(2160,260),(2160,550),(2120,550)],'reject',2090,430)
D.box(1750,710,370,90,'A · Begin planning',['Continue on Workflow Part 2'],'person')
D.edge([(1940,320),(1940,450),(1710,450),(1710,755),(1750,755)],'approve',1718,669)
D.box(450,490,370,120,'Coordinator: withdraw',['If under-review withdrawal is chosen','Close request and retain history'],'external')
D.edge([(1250,295),(1170,295),(1170,460),(635,460),(635,490)],'withdraw instead of continuing review',685,445)
panel_note(D,840,['Submission and clarification replies show In review to the Organiser. Questions show Clarification required.', 'Assignment and decisions notify relevant recipients. Request approval alone does not reserve venues or equipment.'])
D.save('workflow-part-1.svg','Whole-project target • Sources: Week 1 / 4 / 7 requirements and current supplied backlog • Named continuation points are navigation, not system components.')

D=Diagram('Workflow Part 2 · Arrangements and safety','Continue from A. Venue and equipment work can run in parallel; BOTH must be ready before safety review.',w=2200,h=1090)
D.box(45,410,320,120,'Coordinator: plan',['A · Identify required spaces','and essential technical needs'])
D.box(500,190,390,140,'Venue Staff: review bookings',['Coordinator searches / requests venues','Check each booking independently','Approve, or return reasons / alternatives'])
D.box(500,650,390,140,'Technical Support: reserve',['Coordinator records requirements','Check operational stock and availability','Reserve, or propose alternatives'])
D.edge([(365,450),(415,450),(415,260),(500,260)],'venue work',427,244)
D.edge([(365,490),(415,490),(415,720),(500,720)],'equipment work',425,704)
D.box(1000,410,380,140,'All arrangements ready?',['Every required venue approved','All essential equipment reserved','No unresolved arrangement issues'],'planned')
D.edge([(890,260),(965,260),(965,450),(1000,450)],'venue outcomes',1010,272)
D.edge([(890,720),(965,720),(965,510),(1000,510)],'technical outcomes / none needed',1010,719)
D.box(500,410,390,120,'Coordinator: revise plans',['Resolve rejections or shortages','Change affected requests / alternatives'])
D.edge([(1000,480),(890,480)],'not ready',902,466)
D.edge([(635,410),(635,330)],'revised venue request',455,372)
D.edge([(735,530),(735,650)],'revised equipment requirements',445,610)
D.box(1510,410,390,140,'Safety Officer: review',['Awaiting Safety Review','Assess operational safety factors','Record approval or required revisions'])
D.edge([(1380,470),(1510,470)],'all ready',1402,455)
D.box(1510,790,390,120,'Coordinator: safety revisions',['Receive reasons and named issues','Revise affected arrangements'])
D.edge([(1705,550),(1705,790)],'reject / request changes',1720,674)
D.edge([(1510,850),(935,850),(935,600),(840,600),(840,530)],'revise, regain approvals and resubmit through readiness',1040,885)
D.box(1970,410,190,140,'B · Safety approved',['May enter preparation','Go to Workflow Part 3'],'person')
D.edge([(1900,470),(1970,470)],'approve',1904,451)
panel_note(D,977,['Venue work includes multiple bookings, optional expiring holds, availability and suitability checks, plus setup / turnaround time.', 'Rejecting one venue does not cancel other bookings. Safety rejection returns affected plans for revision; preparation / confirmation stays blocked.', 'Expired holds free availability; resource problems and significant changes require affected arrangements to be rechecked.'])
D.save('workflow-part-2.svg','Booking granularity: 15 minutes. All required venue and technical arrangements must be ready; this gate is not an either/or choice.')

D=Diagram('Workflow Part 3 · Confirmation, delivery and completion','Continue from B. Registration is optional; staff preparation and attendee actions may happen alongside each other.',w=2200,h=980)
D.box(50,220,330,140,'Coordinator: confirm',['B · Safety approved','Check essential arrangements remain ready','Confirm and notify relevant users'])
D.box(490,220,350,140,'Registration enabled?',['Organiser sees confirmed arrangements','Coordinator controls registration'],'planned')
D.edge([(380,290),(490,290)],'confirmed',398,272)
D.box(950,120,380,140,'Attendee: register',['While confirmed and registration open','Register, or join waitlist if full','Receive confirmation and updates'])
D.edge([(840,260),(890,260),(890,190),(950,190)],'yes',906,175)
D.box(950,450,380,140,'Venue / Technical Staff: prepare',['Prepare approved venue and equipment','Provide support for event delivery'])
D.edge([(840,320),(890,320),(890,520),(950,520)],'no registration needed',658,427)
D.edge([(1140,260),(1140,365),(1540,365),(1540,450)],'attend when event takes place',1190,350)
D.edge([(215,360),(215,655),(1040,655),(1040,590)],'staff prepare in parallel; do not wait for registrations',290,640)
D.box(1460,450,300,140,'Event takes place',['Coordinator oversees delivery','Attendees attend as applicable'])
D.edge([(1330,520),(1460,520)],'resources ready',1338,503)
D.box(1840,450,310,140,'Completed',['Coordinator marks after event end','Retain read-only event history','Remove from active event lists'])
D.edge([(1760,520),(1840,520)],'ended',1775,503)
D.box(1840,150,310,140,'Automatic completion',['If still Confirmed and not completed','Complete 7 days after event end'])
D.edge([(1660,450),(1660,220),(1840,220)],'not marked completed',1640,342)
D.edge([(1995,290),(1995,450)],'7-day deadline',2010,375)
D.box(1460,720,690,120,'Technical Support: equipment return and follow-up',['Record returns, damage, missing items and operational status','Update availability; prevent unusable units being reserved again'])
D.edge([(1600,590),(1600,720)],'equipment returned',1615,663)
panel_note(D,895,['Waiting list: offer a freed place in queue order; allow 3 days to accept. Withdrawal frees a place. Registration is optional.', 'Equipment return is a separate operational follow-up, not an extra condition invented for marking the event Completed.'])
D.save('workflow-part-3.svg','Significant changes or resource problems can interrupt this journey: recheck affected arrangements and safety before proceeding.')


# Generate the current C1–C3 from their maintained source.
if __name__ == "__main__":
 import runpy
 runpy.run_path(str(P / "generate_architecture.py"), run_name="__main__")
