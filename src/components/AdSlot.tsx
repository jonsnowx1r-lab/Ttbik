import { isOwnerServer } from "@/lib/isOwner";

/**
 * Named placement seam for the ad network (3nbf4.com) — renders nothing to
 * real visitors until real ad code is dropped into the matching branch
 * below. Visible only to the owner (dashed placeholder) so placement can be
 * confirmed before any ad code exists.
 *
 * To activate a position: paste the network's snippet for that zone into
 * its case below, replacing the `null` placeholder.
 */
const AD_CODE: Record<string, string | null> = {
  "header-banner": null,
  "in-content": null,
  "footer-banner": null,
};

export default function AdSlot({ position, label }: { position: keyof typeof AD_CODE; label: string }) {
  const code = AD_CODE[position];

  if (code) {
    return <div className="ad-slot" data-ad-position={position} dangerouslySetInnerHTML={{ __html: code }} />;
  }

  if (!isOwnerServer()) return null;

  return (
    <div className="rounded border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
      📢 موضع إعلان محجوز: {label} ({position}) — لا يظهر للزوار حتى يُوضع كود الإعلان
    </div>
  );
}
