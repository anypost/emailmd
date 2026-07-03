// Inline SVG icons (path data from lucide, https://lucide.dev — ISC license).
import type { SVGProps } from 'react';

type IconNode = Array<[string, Record<string, string>]>;

function icon(node: IconNode) {
  return function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {node.map(([Tag, attrs], i) => {
          const T = Tag as 'path';
          return <T key={i} {...attrs} />;
        })}
      </svg>
    );
  };
}

export const BoldIcon = icon([["path",{"d":"M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"}]] as IconNode);
export const ItalicIcon = icon([["line",{"x1":"19","x2":"10","y1":"4","y2":"4"}],["line",{"x1":"14","x2":"5","y1":"20","y2":"20"}],["line",{"x1":"15","x2":"9","y1":"4","y2":"20"}]] as IconNode);
export const UnderlineIcon = icon([["path",{"d":"M6 4v6a6 6 0 0 0 12 0V4"}],["line",{"x1":"4","x2":"20","y1":"20","y2":"20"}]] as IconNode);
export const StrikethroughIcon = icon([["path",{"d":"M16 4H9a3 3 0 0 0-2.83 4"}],["path",{"d":"M14 12a4 4 0 0 1 0 8H6"}],["line",{"x1":"4","x2":"20","y1":"12","y2":"12"}]] as IconNode);
export const HighlighterIcon = icon([["path",{"d":"m9 11-6 6v3h9l3-3"}],["path",{"d":"m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"}]] as IconNode);
export const HeadingIcon = icon([["path",{"d":"M6 12h12"}],["path",{"d":"M6 20V4"}],["path",{"d":"M18 20V4"}]] as IconNode);
export const Heading1Icon = icon([["path",{"d":"M4 12h8"}],["path",{"d":"M4 18V6"}],["path",{"d":"M12 18V6"}],["path",{"d":"m17 12 3-2v8"}]] as IconNode);
export const Heading2Icon = icon([["path",{"d":"M4 12h8"}],["path",{"d":"M4 18V6"}],["path",{"d":"M12 18V6"}],["path",{"d":"M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"}]] as IconNode);
export const Heading3Icon = icon([["path",{"d":"M4 12h8"}],["path",{"d":"M4 18V6"}],["path",{"d":"M12 18V6"}],["path",{"d":"M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"}],["path",{"d":"M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"}]] as IconNode);
export const Heading4Icon = icon([["path",{"d":"M12 18V6"}],["path",{"d":"M17 10v3a1 1 0 0 0 1 1h3"}],["path",{"d":"M21 10v8"}],["path",{"d":"M4 12h8"}],["path",{"d":"M4 18V6"}]] as IconNode);
export const ListIcon = icon([["path",{"d":"M3 5h.01"}],["path",{"d":"M3 12h.01"}],["path",{"d":"M3 19h.01"}],["path",{"d":"M8 5h13"}],["path",{"d":"M8 12h13"}],["path",{"d":"M8 19h13"}]] as IconNode);
export const ListOrderedIcon = icon([["path",{"d":"M11 5h10"}],["path",{"d":"M11 12h10"}],["path",{"d":"M11 19h10"}],["path",{"d":"M4 4h1v5"}],["path",{"d":"M4 9h2"}],["path",{"d":"M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"}]] as IconNode);
export const ListChecksIcon = icon([["path",{"d":"M13 5h8"}],["path",{"d":"M13 12h8"}],["path",{"d":"M13 19h8"}],["path",{"d":"m3 17 2 2 4-4"}],["path",{"d":"m3 7 2 2 4-4"}]] as IconNode);
export const QuoteIcon = icon([["path",{"d":"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"}],["path",{"d":"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"}]] as IconNode);
export const MinusIcon = icon([["path",{"d":"M5 12h14"}]] as IconNode);
export const SquareCodeIcon = icon([["path",{"d":"m10 9-3 3 3 3"}],["path",{"d":"m14 15 3-3-3-3"}],["rect",{"x":"3","y":"3","width":"18","height":"18","rx":"2"}]] as IconNode);
export const TableIcon = icon([["path",{"d":"M12 3v18"}],["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M3 9h18"}],["path",{"d":"M3 15h18"}]] as IconNode);
export const LinkIcon = icon([["path",{"d":"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"}],["path",{"d":"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"}]] as IconNode);
export const ImageIcon = icon([["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2"}],["circle",{"cx":"9","cy":"9","r":"2"}],["path",{"d":"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"}]] as IconNode);
export const MousePointerClickIcon = icon([["path",{"d":"M14 4.1 12 6"}],["path",{"d":"m5.1 8-2.9-.8"}],["path",{"d":"m6 12-1.9 2"}],["path",{"d":"M7.2 2.2 8 5.1"}],["path",{"d":"M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"}]] as IconNode);
export const LayoutPanelTopIcon = icon([["rect",{"width":"18","height":"7","x":"3","y":"3","rx":"1"}],["rect",{"width":"7","height":"7","x":"3","y":"14","rx":"1"}],["rect",{"width":"7","height":"7","x":"14","y":"14","rx":"1"}]] as IconNode);
export const ChevronDownIcon = icon([["path",{"d":"m6 9 6 6 6-6"}]] as IconNode);
export const ChevronsUpDownIcon = icon([["path",{"d":"m7 15 5 5 5-5"}],["path",{"d":"m7 9 5-5 5 5"}]] as IconNode);
export const RotateCcwIcon = icon([["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}]] as IconNode);
export const CheckIcon = icon([["path",{"d":"M20 6 9 17l-5-5"}]] as IconNode);
export const CopyIcon = icon([["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]] as IconNode);
export const SmileIcon = icon([["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M8 14s1.5 2 4 2 4-2 4-2"}],["line",{"x1":"9","x2":"9.01","y1":"9","y2":"9"}],["line",{"x1":"15","x2":"15.01","y1":"9","y2":"9"}]] as IconNode);
export const PaintbrushIcon = icon([["path",{"d":"m14.622 17.897-10.68-2.913"}],["path",{"d":"M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z"}],["path",{"d":"M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15"}]] as IconNode);
export const CodeIcon = icon([["path",{"d":"m16 18 6-6-6-6"}],["path",{"d":"m8 6-6 6 6 6"}]] as IconNode);
export const XIcon = icon([["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]] as IconNode);
export const MonitorIcon = icon([["rect",{"width":"20","height":"14","x":"2","y":"3","rx":"2"}],["line",{"x1":"8","x2":"16","y1":"21","y2":"21"}],["line",{"x1":"12","x2":"12","y1":"17","y2":"21"}]] as IconNode);
export const SmartphoneIcon = icon([["rect",{"width":"14","height":"20","x":"5","y":"2","rx":"2","ry":"2"}],["path",{"d":"M12 18h.01"}]] as IconNode);
export const InfoIcon = icon([["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]] as IconNode);
export const PencilIcon = icon([["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{"d":"m15 5 4 4"}]] as IconNode);
export const PlusIcon = icon([["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]] as IconNode);
export const DownloadIcon = icon([["path",{"d":"M12 15V3"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["path",{"d":"m7 10 5 5 5-5"}]] as IconNode);
export const Share2Icon = icon([["circle",{"cx":"18","cy":"5","r":"3"}],["circle",{"cx":"6","cy":"12","r":"3"}],["circle",{"cx":"18","cy":"19","r":"3"}],["line",{"x1":"8.59","x2":"15.42","y1":"13.51","y2":"17.49"}],["line",{"x1":"15.41","x2":"8.59","y1":"6.51","y2":"10.49"}]] as IconNode);
export const TriangleAlertIcon = icon([["path",{"d":"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}],["path",{"d":"M12 9v4"}],["path",{"d":"M12 17h.01"}]] as IconNode);
