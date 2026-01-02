--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

-- Started on 2025-08-29 09:37:22

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 43321)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5033 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 926 (class 1247 OID 43359)
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'ADMIN',
    'PROFESOR',
    'ESTUDIANTE'
);


ALTER TYPE public.user_role OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 234 (class 1259 OID 43400)
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    user_id uuid NOT NULL,
    author_name text,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comments_content_check CHECK (((length(content) >= 1) AND (length(content) <= 1000)))
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 35118)
-- Name: documentos_texto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documentos_texto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id uuid NOT NULL,
    tipo text NOT NULL,
    texto text,
    video_id text,
    file_name text,
    texto_extraido text,
    creado_en timestamp without time zone DEFAULT now(),
    num_paginas integer,
    num_lineas integer,
    num_palabras integer,
    num_frases integer,
    resumen text,
    posiciones jsonb
);


ALTER TABLE public.documentos_texto OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16435)
-- Name: scene_segments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scene_segments (
    id integer NOT NULL,
    video_id text,
    scene_index integer,
    start_time numeric,
    end_time numeric
);


ALTER TABLE public.scene_segments OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16434)
-- Name: scene_segments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.scene_segments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scene_segments_id_seq OWNER TO postgres;

--
-- TOC entry 5034 (class 0 OID 0)
-- Dependencies: 218
-- Name: scene_segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.scene_segments_id_seq OWNED BY public.scene_segments.id;


--
-- TOC entry 221 (class 1259 OID 16449)
-- Name: transcriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transcriptions (
    id integer NOT NULL,
    video_id text,
    start_time numeric,
    end_time numeric,
    text text
);


ALTER TABLE public.transcriptions OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16448)
-- Name: transcriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transcriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transcriptions_id_seq OWNER TO postgres;

--
-- TOC entry 5035 (class 0 OID 0)
-- Dependencies: 220
-- Name: transcriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transcriptions_id_seq OWNED BY public.transcriptions.id;


--
-- TOC entry 222 (class 1259 OID 16462)
-- Name: uploads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.uploads (
    id text NOT NULL,
    custom_id text,
    file_key text,
    file_name text,
    size_in_bytes bigint,
    status text,
    uploaded_at timestamp without time zone,
    signed_url text,
    file_path text,
    tipo text,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    category text DEFAULT 'otros'::text NOT NULL,
    CONSTRAINT uploads_category_check CHECK ((category = ANY (ARRAY['peliculas'::text, 'documentales'::text, 'cortos'::text, 'otros'::text])))
);


ALTER TABLE public.uploads OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 43365)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role public.user_role DEFAULT 'ESTUDIANTE'::public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16492)
-- Name: video_frames; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_frames (
    id integer NOT NULL,
    video_id uuid NOT NULL,
    frame_number integer,
    time_sec numeric,
    image_data bytea,
    mime_type text DEFAULT 'image/jpeg'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.video_frames OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 16491)
-- Name: video_frames_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.video_frames_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.video_frames_id_seq OWNER TO postgres;

--
-- TOC entry 5036 (class 0 OID 0)
-- Dependencies: 227
-- Name: video_frames_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.video_frames_id_seq OWNED BY public.video_frames.id;


--
-- TOC entry 224 (class 1259 OID 16471)
-- Name: video_objects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_objects (
    id integer NOT NULL,
    video_id uuid NOT NULL,
    frame integer,
    time_sec numeric,
    objects text[],
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.video_objects OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16470)
-- Name: video_objects_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.video_objects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.video_objects_id_seq OWNER TO postgres;

--
-- TOC entry 5037 (class 0 OID 0)
-- Dependencies: 223
-- Name: video_objects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.video_objects_id_seq OWNED BY public.video_objects.id;


--
-- TOC entry 226 (class 1259 OID 16483)
-- Name: video_poses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_poses (
    id integer NOT NULL,
    video_id uuid,
    frame integer,
    rostro_detectado boolean,
    mano_izq_arriba boolean,
    time_sec real,
    l_shoulder_x real,
    l_shoulder_y real,
    l_shoulder_z real,
    l_wrist_x real,
    l_wrist_y real,
    l_wrist_z real,
    frame_path text
);


ALTER TABLE public.video_poses OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16482)
-- Name: video_poses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.video_poses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.video_poses_id_seq OWNER TO postgres;

--
-- TOC entry 5038 (class 0 OID 0)
-- Dependencies: 225
-- Name: video_poses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.video_poses_id_seq OWNED BY public.video_poses.id;


--
-- TOC entry 231 (class 1259 OID 27241)
-- Name: video_reels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_reels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    video_id text,
    duracion integer,
    archivo bytea,
    created_at timestamp without time zone DEFAULT now(),
    path text
);


ALTER TABLE public.video_reels OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 26640)
-- Name: video_subtitulos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_subtitulos (
    id integer NOT NULL,
    video_id text,
    time_start real,
    time_end real,
    text text
);


ALTER TABLE public.video_subtitulos OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 26639)
-- Name: video_subtitulos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.video_subtitulos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.video_subtitulos_id_seq OWNER TO postgres;

--
-- TOC entry 5039 (class 0 OID 0)
-- Dependencies: 229
-- Name: video_subtitulos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.video_subtitulos_id_seq OWNED BY public.video_subtitulos.id;


--
-- TOC entry 4827 (class 2604 OID 16438)
-- Name: scene_segments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_segments ALTER COLUMN id SET DEFAULT nextval('public.scene_segments_id_seq'::regclass);


--
-- TOC entry 4828 (class 2604 OID 16452)
-- Name: transcriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transcriptions ALTER COLUMN id SET DEFAULT nextval('public.transcriptions_id_seq'::regclass);


--
-- TOC entry 4834 (class 2604 OID 16495)
-- Name: video_frames id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_frames ALTER COLUMN id SET DEFAULT nextval('public.video_frames_id_seq'::regclass);


--
-- TOC entry 4831 (class 2604 OID 16474)
-- Name: video_objects id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_objects ALTER COLUMN id SET DEFAULT nextval('public.video_objects_id_seq'::regclass);


--
-- TOC entry 4833 (class 2604 OID 16486)
-- Name: video_poses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_poses ALTER COLUMN id SET DEFAULT nextval('public.video_poses_id_seq'::regclass);


--
-- TOC entry 4837 (class 2604 OID 26643)
-- Name: video_subtitulos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_subtitulos ALTER COLUMN id SET DEFAULT nextval('public.video_subtitulos_id_seq'::regclass);


--
-- TOC entry 4876 (class 2606 OID 43409)
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- TOC entry 4870 (class 2606 OID 35125)
-- Name: documentos_texto documentos_texto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos_texto
    ADD CONSTRAINT documentos_texto_pkey PRIMARY KEY (id);


--
-- TOC entry 4851 (class 2606 OID 16442)
-- Name: scene_segments scene_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_segments
    ADD CONSTRAINT scene_segments_pkey PRIMARY KEY (id);


--
-- TOC entry 4853 (class 2606 OID 16456)
-- Name: transcriptions transcriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transcriptions
    ADD CONSTRAINT transcriptions_pkey PRIMARY KEY (id);


--
-- TOC entry 4866 (class 2606 OID 27262)
-- Name: video_reels unique_path; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_reels
    ADD CONSTRAINT unique_path UNIQUE (path);


--
-- TOC entry 4856 (class 2606 OID 16468)
-- Name: uploads uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);


--
-- TOC entry 4872 (class 2606 OID 43377)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4874 (class 2606 OID 43375)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4862 (class 2606 OID 16501)
-- Name: video_frames video_frames_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_frames
    ADD CONSTRAINT video_frames_pkey PRIMARY KEY (id);


--
-- TOC entry 4858 (class 2606 OID 16479)
-- Name: video_objects video_objects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_objects
    ADD CONSTRAINT video_objects_pkey PRIMARY KEY (id);


--
-- TOC entry 4860 (class 2606 OID 16488)
-- Name: video_poses video_poses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_poses
    ADD CONSTRAINT video_poses_pkey PRIMARY KEY (id);


--
-- TOC entry 4868 (class 2606 OID 27249)
-- Name: video_reels video_reels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_reels
    ADD CONSTRAINT video_reels_pkey PRIMARY KEY (id);


--
-- TOC entry 4864 (class 2606 OID 26647)
-- Name: video_subtitulos video_subtitulos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_subtitulos
    ADD CONSTRAINT video_subtitulos_pkey PRIMARY KEY (id);


--
-- TOC entry 4877 (class 1259 OID 43420)
-- Name: idx_comments_upload_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_upload_created ON public.comments USING btree (upload_id, created_at DESC);


--
-- TOC entry 4854 (class 1259 OID 43385)
-- Name: uploads_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX uploads_category_idx ON public.uploads USING btree (category);


--
-- TOC entry 4881 (class 2606 OID 43410)
-- Name: comments comments_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id) ON DELETE CASCADE;


--
-- TOC entry 4882 (class 2606 OID 43415)
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4880 (class 2606 OID 35128)
-- Name: documentos_texto documentos_texto_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documentos_texto
    ADD CONSTRAINT documentos_texto_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.uploads(id);


--
-- TOC entry 4879 (class 2606 OID 27250)
-- Name: video_reels video_reels_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_reels
    ADD CONSTRAINT video_reels_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.uploads(id);


--
-- TOC entry 4878 (class 2606 OID 26648)
-- Name: video_subtitulos video_subtitulos_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_subtitulos
    ADD CONSTRAINT video_subtitulos_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.uploads(id);


-- Completed on 2025-08-29 09:37:22

--
-- PostgreSQL database dump complete
--

