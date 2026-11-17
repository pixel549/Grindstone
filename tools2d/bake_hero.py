#!/usr/bin/env python3
"""Bakes the Universal LPC layers Grindstone's hero uses into assets/2d/hero/.

Run:  LPC=/path/to/Universal-LPC-Spritesheet-Character-Generator python3 tools2d/bake_hero.py

Copies only the sheets each item needs (per body type, per animation, per chosen variant) and writes
index.json: item layers (z order, paths, animations), recolour specs and the merged palettes.
assets/lpchero.js composites and recolours them at runtime.
"""
import json, os, shutil, sys

ROOT = os.environ.get('LPC', '/home/claude/dl/lpc_full')
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', '2d', 'hero')
DEFS = os.path.join(ROOT, 'sheet_definitions')
SHEETS = os.path.join(ROOT, 'spritesheets')
FOLDER = {'combat': 'combat_idle', '1h_slash': 'backslash', '1h_backslash': 'backslash', '1h_halfslash': 'halfslash'}

LIFE = ['walk', 'idle', 'sit', 'emote', 'slash', 'thrust', 'spellcast', 'jump', 'climb', 'hurt']
KIT = ['walk', 'idle', 'slash', 'thrust', 'spellcast', 'hurt']
KID = ['walk', 'idle']
CUSTOM = {'slash_128': (128, 'slash'), 'slash_oversize': (192, 'slash'), 'thrust_oversize': (192, 'thrust')}  # weapons and shields: portraits, and swinging in the delve

# id: (definition, variants to ship or None, animations)
ITEMS = {
    'body': ('body/body.json', None, LIFE),
    'head_m': ('head/heads/human/heads_human_male.json', None, LIFE),
    'head_f': ('head/heads/human/heads_human_female.json', None, LIFE),
    # hair
    'hair_cropped': ('hair/bald/hair_buzzcut.json', None, LIFE),
    'hair_parted': ('hair/short/hair_parted.json', None, LIFE),
    'hair_long': ('hair/long/hair_long.json', None, LIFE),
    'hair_buns': ('hair/braids/hair_bangs_bun.json', None, LIFE),
    'hair_shorn': ('hair/bald/hair_high_and_tight.json', None, LIFE),
    'hair_messy': ('hair/short/hair_messy1.json', None, LIFE),
    'hair_ponytail': ('hair/braids/hair_ponytail.json', None, LIFE),
    'hair_curly': ('hair/curly/hair_curly_short.json', None, LIFE),
    'hair_afro': ('hair/afro/hair_afro.json', None, LIFE),
    'hair_mohawk': ('hair/bald/hair_shorthawk.json', None, LIFE),
    'hair_bob': ('hair/bob/hair_bob.json', None, LIFE),
    'hair_spiky': ('hair/spiky/hair_spiked.json', None, LIFE),
    'hair_dreads': ('hair/afro/hair_dreadlocks_short.json', None, LIFE),
    'hair_balding': ('hair/bald/hair_balding.json', None, LIFE),
    'beard_beard': ('hair/beards/beards_beard.json', None, LIFE),
    'beard_stubble': ('hair/beards/beards_5oclock_shadow.json', None, LIFE),
    'beard_trimmed': ('hair/beards/beards_trimmed.json', None, LIFE),
    'beard_bushy': ('hair/beards/beards_winter.json', None, LIFE),
    'beard_moustache': ('hair/mustaches/beards_mustache.json', None, LIFE),
    'glasses': ('headwear/accessories/glasses/facial_glasses.json', ['black', 'brown'], LIFE),
    'eyepatch': ('headwear/accessories/eyepatch/facial_eyepatch_left.json', ['black'], LIFE),
    # clothes
    'shirt_s': ('torso/shirts/shortsleeve/torso_clothes_shortsleeve.json', None, LIFE),
    'shirt_l': ('torso/shirts/longsleeve/torso_clothes_longsleeve.json', None, LIFE),
    'pants': ('legs/pants/legs_pants.json', None, LIFE),
    'shoes': ('feet/shoes/feet_shoes_basic.json', None, LIFE),
    'boots': ('feet/boots/feet_boots_basic.json', None, LIFE),
    'belt': ('torso/waist/belt_leather.json', ['leather', 'brown', 'charcoal', 'slate'], LIFE),
    # body armour
    'leather': ('torso/armour/torso_armour_leather.json', None, LIFE),
    'plate': ('torso/armour/torso_armour_plate.json', None, LIFE),
    'legion': ('torso/armour/torso_armour_legion.json', None, LIFE),
    'mail': ('torso/torso_chainmail.json', None, LIFE),
    'robe': ('torso/shirts/torso_clothes_robe.json', ['brown', 'forest green', 'blue', 'purple', 'red', 'black'], LIFE),
    'frock': ('torso/jacket/torso_jacket_frock.json', ['walnut', 'forest', 'navy', 'purple', 'maroon', 'charcoal'], LIFE),
    'trench': ('torso/jacket/torso_jacket_trench.json', ['dark gray', 'gray'], LIFE),
    'tabard': ('torso/jacket/torso_jacket_tabard.json', ['walnut', 'forest', 'navy', 'purple', 'maroon', 'black'], LIFE),
    'cape': ('torso/cape/cape_solid.json', None, LIFE),
    'arms_armour': ('arms/arms_armour.json', None, LIFE),
    'gloves': ('arms/arms_gloves.json', None, LIFE),
    'bracers': ('arms/wrists/arms_bracers.json', None, LIFE),
    'pauldrons': ('arms/shoulders/shoulders_pauldrons.json', None, LIFE),
    'legs_armour': ('legs/legs_armour.json', None, LIFE),
    'feet_armour': ('feet/feet_armour.json', None, LIFE),
    # headwear
    'hood': ('headwear/coverings/hoods/hat_hood_cloth.json', None, LIFE),
    'tricorne': ('headwear/hats/tricorne/hat_tricorne.json', ['brown', 'black', 'navy', 'maroon'], LIFE),
    'cavalier': ('headwear/hats/caps/hat_cap_cavalier_feather.json', ['brown', 'black', 'forest', 'maroon'], LIFE),
    'kettle': ('headwear/helmets/helmets/hat_helmet_kettle.json', None, LIFE),
    'nasal': ('headwear/helmets/helmets/hat_helmet_nasal.json', None, LIFE),
    'barbuta': ('headwear/helmets/helmets/hat_helmet_barbuta.json', None, LIFE),
    'armet': ('headwear/helmets/helmets/hat_helmet_armet.json', None, LIFE),
    'greathelm': ('headwear/helmets/helmets/hat_helmet_greathelm.json', None, LIFE),
    'bascinet': ('headwear/helmets/helmets/hat_helmet_bascinet.json', None, LIFE),
    'bascinet_r': ('headwear/helmets/helmets/hat_helmet_bascinet_round.json', None, LIFE),
    'tiara': ('headwear/hats/formal/hat_formal_tiara.json', ['tiara_bronze', 'tiara_silver', 'tiara_gold'], LIFE),
    'crown': ('headwear/hats/formal/hat_formal_crown.json', ['crown_gray', 'crown_blue', 'crown_red', 'crown_gold'], LIFE),
    'mask': ('headwear/accessories/facial_mask_plain.json', ['dark', 'black', 'white'], LIFE),
    'charm': ('headwear/neck/charms/neck_charm_oval.json', ['iron', 'steel', 'silver', 'gold'], LIFE),
    'gem': ('headwear/neck/charms/neck_gem_pear.json', ['green', 'blue', 'purple', 'red', 'orange'], LIFE),
    # weapons (portraits only)
    'w_arming': ('weapons/sword/weapon_sword_arming.json', ['iron', 'steel', 'silver', 'gold'], KIT),
    'w_longsword': ('weapons/sword/weapon_sword_longsword.json', None, KIT),
    'w_rapier': ('weapons/sword/weapon_sword_rapier.json', None, KIT),
    'w_saber': ('weapons/sword/weapon_sword_saber.json', None, KIT),
    'w_dagger': ('weapons/sword/weapon_sword_dagger.json', None, KIT),
    'w_waraxe': ('weapons/blunt/weapon_blunt_waraxe.json', None, KIT),
    'w_mace': ('weapons/blunt/weapon_blunt_mace.json', None, KIT),
    'w_halberd': ('weapons/polearm/weapon_polearm_halberd.json', None, KIT),
    'w_spear': ('weapons/polearm/weapon_polearm_spear.json', ['dark', 'medium', 'light'], KIT),
    'w_scythe': ('weapons/polearm/weapon_polearm_scythe.json', None, KIT),
    'w_crystal': ('weapons/magic/weapon_magic_crystal.json', ['orange', 'blue', 'purple'], KIT),
    'w_gnarled': ('weapons/magic/weapon_magic_gnarled.json', ['dark', 'medium', 'light'], KIT),
    'w_hammer': ('tools/tool_hammer.json', None, KIT),
    'w_axe': ('tools/tool_axe.json', None, KIT),
    's_heater': ('weapons/shields/heater/shield_heater_revised_wood.json', None, KIT),
    's_paint': ('weapons/shields/heater/shield_heater_revised_paint.json', None, KIT),
    's_trim': ('weapons/shields/heater/shield_heater_revised_trim.json', None, KIT),
    's_round': ('weapons/shields/shield_round.json', ['brown', 'black', 'silver', 'gold'], KIT),
    # tools for chores
    't_can': ('tools/tool_watering_can.json', None, ['walk']),
    # 2.26: kids (the child body; their clothes only come walking, so lpchero stands them still from the first frame)
    'head_c': ('head/heads/human/heads_human_child.json', None, KID),
    'shirt_c': ('torso/shirts/torso_clothes_child_shirt.json', ['black', 'blue', 'brown', 'gray', 'green', 'lavender', 'lightblue', 'pink', 'red', 'white'], KID),
    'pants_c': ('legs/pants/legs_childpants.json', ['black', 'blue', 'brown', 'darkblue', 'green', 'lightblue', 'maroon', 'red', 'white'], KID),
    'skirt_c': ('legs/skirts/legs_childskirts.json', ['black', 'blue', 'darkblue', 'green', 'lavender', 'lightblue', 'maroon', 'pink', 'red', 'white'], KID),
    'hair_c_parted': ('hair/short/hair_parted_side_bangs.json', None, KID),
    'hair_c_swoop': ('hair/short/hair_swoop_side.json', None, KID),
    'hair_c_long': ('hair/long/hair_wavy_child.json', None, KID),
    'hair_c_bob': ('hair/bob/hair_relm_short.json', None, KID),
    'hair_c_curly': ('hair/curly/hair_jewfro.json', None, KID),
}


def palettes():
    out, bases = {}, {}
    d = os.path.join(ROOT, 'palette_definitions')
    for mat in sorted(os.listdir(d)):
        md = os.path.join(d, mat)
        if not os.path.isdir(md) or mat == 'all':
            continue
        merged = {}
        files = sorted((f for f in os.listdir(md) if not f.startswith('meta_')), key=lambda f: (0 if 'ulpc' in f else 1, f))
        for f in files:
            for k, v in json.load(open(os.path.join(md, f))).items():
                if isinstance(v, list):
                    merged.setdefault(k, []).append(v)
        meta = os.path.join(md, 'meta_' + mat + '.json')
        bases[mat] = json.load(open(meta)).get('base') if os.path.exists(meta) else None
        out[mat] = merged
    return out, bases


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    copied, items, missing = set(), {}, []
    for iid, (dpath, variants, anims) in ITEMS.items():
        d = json.load(open(os.path.join(DEFS, dpath)))
        allowed = d.get('animations')
        rec = d.get('recolors') or None
        vars_ = [v for v in (variants or [])]
        if not rec and not vars_ and d.get('variants'):
            vars_ = [d['variants'][0]]
        entry = {'rec': rec, 'variants': vars_, 'layers': {}}
        for body in ('male', 'female', 'child'):
            if body == 'child' and anims not in (LIFE, KID):
                continue
            if body == 'child' and anims is LIFE and iid not in ('body', 'glasses'):
                continue   # only what's drawn for kids
            lays = []
            for k in sorted(k for k in d if k.startswith('layer_')):
                L = d[k]
                if L.get('custom_animation'):
                    continue
                base = L.get(body)
                if not base:
                    continue
                have = []
                for a in anims:
                    if allowed and a not in allowed:
                        continue
                    folder = FOLDER.get(a, a)
                    if rec:
                        srcs = [(base + folder + '.png')]
                    else:
                        srcs = [base + folder + '/' + v.replace(' ', '_') + '.png' for v in vars_]
                    ok = all(os.path.exists(os.path.join(SHEETS, s)) for s in srcs)
                    if not ok:
                        continue
                    for s in srcs:
                        if s not in copied:
                            dst = os.path.join(OUT, s)
                            os.makedirs(os.path.dirname(dst), exist_ok=True)
                            shutil.copyfile(os.path.join(SHEETS, s), dst)
                            copied.add(s)
                    have.append(a)
                if have:
                    lays.append({'z': L['zPos'], 'base': base, 'anims': have})
            if lays:
                entry['layers'][body] = lays
        # weapons swing in bigger frames (the generator's custom animations): copy those too, for the delve
        if anims is KIT:
            cust = {}
            for k in sorted(k for k in d if k.startswith('layer_')):
                L = d[k]
                ca = L.get('custom_animation')
                if ca not in CUSTOM or not L.get('male'):
                    continue
                base = L['male']
                srcs = [base + v.replace(' ', '_') + '.png' for v in (vars_ or d.get('variants') or [])]
                srcs = [x for x in srcs if os.path.exists(os.path.join(SHEETS, x))]
                if not srcs:
                    dd = os.path.join(SHEETS, base)
                    pngs = sorted(f for f in os.listdir(dd) if f.endswith('.png')) if os.path.isdir(dd) else []
                    srcs = [base + pngs[0]] if pngs else []
                if not srcs:
                    continue
                for x in srcs:
                    if x not in copied:
                        dst = os.path.join(OUT, x); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(os.path.join(SHEETS, x), dst); copied.add(x)
                c = cust.setdefault(ca, {'size': CUSTOM[ca][0], 'anim': CUSTOM[ca][1], 'layers': []})
                c['layers'].append({'z': L['zPos'], 'base': base, 'files': [x[len(base):] for x in srcs]})
            if cust:
                entry['custom'] = cust
        if not entry['layers']:
            missing.append(iid)
        items[iid] = entry
    pals, bases = palettes()
    json.dump({'items': items, 'palettes': pals, 'bases': bases, 'folder': FOLDER}, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
    total = sum(os.path.getsize(os.path.join(OUT, s)) for s in copied)
    print(f'{len(items)} items, {len(copied)} sheets, {total / 1e6:.1f} MB; no layers: {missing}')


if __name__ == '__main__':
    main()
